use crate::app_state::*;
use crate::cameras::*;
use crate::config_manager::ConfigManager;
use crate::supervisor::*;
use tauri::{Emitter, Manager, State};

/// Inicia el agente (MediaMTX, Cloudflared, cámaras)
#[tauri::command]
pub async fn start_agent(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    log::info!("=== Starting Agent ===");
    
    let mut is_running = state.is_running.lock().await;
    if *is_running {
        return Err("Agent is already running".to_string());
    }
    
    // Crear ConfigManager
    let config_mgr = ConfigManager::new(&app_handle)
        .map_err(|e| format!("Failed to initialize config manager: {}", e))?;
    
    // Asegurar que los configs existen
    config_mgr.initialize_configs()
        .map_err(|e| format!("Failed to initialize configs: {}", e))?;
    
    // Obtener rutas de binarios (con fallback a desarrollo)
    let mediamtx_bin = config_mgr.get_binary_path("mediamtx.exe")
        .map_err(|e| format!("MediaMTX binary not found: {}", e))?;
    let ffmpeg_bin = config_mgr.get_binary_path("ffmpeg.exe")
        .map_err(|e| format!("FFmpeg binary not found: {}", e))?;
    
    log::info!("MediaMTX binary: {:?}", mediamtx_bin);
    log::info!("FFmpeg binary: {:?}", ffmpeg_bin);
    
    let mediamtx_config = config_mgr.get_config_path("mediamtx.yml");
    let cameras_config = config_mgr.get_config_path("cameras.json");
    
    log::info!("MediaMTX config: {:?}", mediamtx_config);
    log::info!("Cameras config: {:?}", cameras_config);
    
    // Iniciar MediaMTX
    log::info!("Starting MediaMTX...");
    let mediamtx_handle = start_mediamtx(&mediamtx_bin, &mediamtx_config)
        .map_err(|e| format!("Failed to start MediaMTX: {}", e))?;
    
    {
        let mut mediamtx_proc = state.mediamtx_process.lock().await;
        *mediamtx_proc = Some(mediamtx_handle);
    }
    log::info!("MediaMTX started successfully");
    
    // Esperar un momento para que MediaMTX inicie
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    
    // Intentar iniciar Cloudflared
    match start_cloudflared_auto(&app_handle, &config_mgr).await {
        Ok(Some(handle)) => {
            let mut cloudflared_proc = state.cloudflared_process.lock().await;
            *cloudflared_proc = Some(handle);
            log::info!("Cloudflared started successfully");
        }
        Ok(None) => {
            log::info!("Cloudflared not started (no configuration)");
        }
        Err(e) => {
            log::warn!("Failed to start Cloudflared (non-critical): {}", e);
        }
    }
    
    // Cargar y auto-iniciar cámaras habilitadas (limpiar estado previo primero)
    {
        let mut cameras = state.cameras.lock().await;
        // Limpiar cámaras existentes en memoria antes de cargar desde config
        cameras.clear();
        
        match init_cameras_from_config(&mut cameras, &cameras_config, &ffmpeg_bin, true).await {
            Ok(count) => {
                log::info!("Initialized {} cameras", count);
            }
            Err(e) => {
                log::error!("Failed to init cameras: {}", e);
            }
        }
    }
    
    *is_running = true;
    
    log::info!("=== Agent Started Successfully ===");
    app_handle.emit("agent-status-changed", AgentStatusPayload { running: true })
        .map_err(|e| e.to_string())?;
    
    Ok("Agent started successfully".to_string())
}

/// Intenta iniciar cloudflared automáticamente
async fn start_cloudflared_auto(
    app_handle: &tauri::AppHandle,
    config_mgr: &ConfigManager,
) -> Result<Option<ProcessHandle>, String> {
    // Buscar binario de cloudflared
    let cloudflared_bin = match config_mgr.get_binary_path("cloudflared.exe") {
        Ok(path) => path,
        Err(_) => {
            log::info!("Cloudflared binary not found, skipping tunnel");
            return Ok(None);
        }
    };
    
    // Detectar si hay túneles configurados en el sistema
    if let Some(tunnel_info) = crate::config_manager::detect_cloudflared_tunnel() {
        if tunnel_info.is_authenticated && !tunnel_info.tunnels.is_empty() {
            // Usar el primer túnel configurado
            let tunnel = &tunnel_info.tunnels[0];
            log::info!("Using existing tunnel: {}", tunnel.tunnel_id);
            
            // Generar config si no existe
            let cloudflared_config = config_mgr.get_config_path("cloudflared-config.yml");
            if !cloudflared_config.exists() {
                crate::config_manager::generate_cloudflared_config(
                    &tunnel.tunnel_id,
                    &tunnel.credentials_file,
                    None, // Sin hostname, usar el por defecto del tunnel
                    8888, // Puerto HLS de MediaMTX
                    &cloudflared_config,
                ).map_err(|e| e.to_string())?;
            }
            
            let handle = start_cloudflared(&cloudflared_bin, &cloudflared_config)
                .map_err(|e| format!("Failed to start cloudflared: {}", e))?;
            return Ok(Some(handle));
        }
    }
    
    // Si no hay túnel configurado, intentar modo Quick Tunnel (sin config)
    log::info!("No existing tunnel found, trying Quick Tunnel mode...");
    let handle = start_cloudflared_quick_tunnel(&cloudflared_bin, 8888)
        .map_err(|e| format!("Failed to start quick tunnel: {}", e))?;
    
    Ok(Some(handle))
}

/// Detiene el agente
#[tauri::command]
pub async fn stop_agent(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    log::info!("Stopping agent...");
    
    let mut is_running = state.is_running.lock().await;
    if !*is_running {
        return Err("Agent is not running".to_string());
    }
    
    // Detener todas las cámaras
    {
        let mut cameras = state.cameras.lock().await;
        if let Err(e) = stop_all_cameras(&mut cameras) {
            log::error!("Error stopping cameras: {}", e);
        }
    }
    
    // Detener Cloudflared
    {
        let mut cloudflared_proc = state.cloudflared_process.lock().await;
        if let Some(handle) = cloudflared_proc.as_mut() {
            if let Err(e) = stop_process(handle) {
                log::error!("Error stopping Cloudflared: {}", e);
            }
        }
        *cloudflared_proc = None;
    }
    
    // Detener MediaMTX
    {
        let mut mediamtx_proc = state.mediamtx_process.lock().await;
        if let Some(handle) = mediamtx_proc.as_mut() {
            if let Err(e) = stop_process(handle) {
                log::error!("Error stopping MediaMTX: {}", e);
            }
        }
        *mediamtx_proc = None;
    }
    
    *is_running = false;
    
    log::info!("Agent stopped successfully");
    app_handle.emit("agent-status-changed", AgentStatusPayload { running: false })
        .map_err(|e| e.to_string())?;
    
    Ok("Agent stopped successfully".to_string())
}

/// Obtiene el estado del agente
#[tauri::command]
pub async fn get_agent_status(state: State<'_, AppState>) -> Result<AgentStatus, String> {
    let is_running = *state.is_running.lock().await;
    
    let mediamtx_running = {
        let mediamtx_proc = state.mediamtx_process.lock().await;
        mediamtx_proc.is_some()
    };
    
    let cloudflared_running = {
        let cloudflared_proc = state.cloudflared_process.lock().await;
        cloudflared_proc.is_some()
    };
    
    let (cameras_running, cameras_total) = {
        let cameras = state.cameras.lock().await;
        let running = cameras.values()
            .filter(|c| c.status == ProcessStatus::Running)
            .count() as u32;
        let total = cameras.len() as u32;
        (running, total)
    };
    
    let tunnel_url = {
        let config = state.config.lock().await;
        config.tunnel_hostname.clone()
    };
    
    // Calcular uptime desde que MediaMTX inició
    let uptime_secs = {
        let mediamtx_proc = state.mediamtx_process.lock().await;
        if let Some(handle) = mediamtx_proc.as_ref() {
            handle.uptime().as_secs()
        } else {
            0
        }
    };
    
    Ok(AgentStatus {
        running: is_running,
        mediamtx_running,
        cloudflared_running,
        cameras_running,
        cameras_total,
        tunnel_url,
        uptime_secs,
    })
}

/// Lista todas las cámaras
#[tauri::command]
pub async fn list_cameras(state: State<'_, AppState>) -> Result<Vec<CameraInfo>, String> {
    let cameras = state.cameras.lock().await;
    Ok(crate::cameras::list_cameras(&cameras))
}

/// Agrega una nueva cámara
#[tauri::command]
pub async fn add_camera(
    state: State<'_, AppState>,
    camera: CameraConfig,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut cameras = state.cameras.lock().await;
    crate::cameras::add_camera(&mut cameras, camera)
        .map_err(|e| e.to_string())?;
    
    // Guardar configuración
    let config_dir = get_config_dir(&app_handle).map_err(|e| e.to_string())?;
    let cameras_config = config_dir.join("cameras.json");
    save_cameras_config(&cameras, &cameras_config).map_err(|e| e.to_string())?;
    
    app_handle.emit("cameras-updated", ()).map_err(|e| e.to_string())?;
    
    Ok("Camera added successfully".to_string())
}

/// Actualiza una cámara existente
#[tauri::command]
pub async fn update_camera(
    state: State<'_, AppState>,
    id: String,
    updates: CameraConfig,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut cameras = state.cameras.lock().await;
    crate::cameras::update_camera(&mut cameras, &id, updates)
        .map_err(|e| e.to_string())?;
    
    // Guardar configuración
    let config_dir = get_config_dir(&app_handle).map_err(|e| e.to_string())?;
    let cameras_config = config_dir.join("cameras.json");
    save_cameras_config(&cameras, &cameras_config).map_err(|e| e.to_string())?;
    
    app_handle.emit("cameras-updated", ()).map_err(|e| e.to_string())?;
    
    Ok("Camera updated successfully".to_string())
}

/// Elimina una cámara
#[tauri::command]
pub async fn remove_camera(
    state: State<'_, AppState>,
    id: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut cameras = state.cameras.lock().await;
    crate::cameras::remove_camera(&mut cameras, &id)
        .map_err(|e| e.to_string())?;
    
    // Guardar configuración
    let config_dir = get_config_dir(&app_handle).map_err(|e| e.to_string())?;
    let cameras_config = config_dir.join("cameras.json");
    save_cameras_config(&cameras, &cameras_config).map_err(|e| e.to_string())?;
    
    app_handle.emit("cameras-updated", ()).map_err(|e| e.to_string())?;
    
    Ok("Camera removed successfully".to_string())
}

/// Inicia una cámara específica
#[tauri::command]
pub async fn start_camera(
    state: State<'_, AppState>,
    id: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let ffmpeg_bin = get_binary_path(&app_handle, "ffmpeg.exe")
        .map_err(|e| format!("FFmpeg binary not found: {}", e))?;
    
    let mut cameras = state.cameras.lock().await;
    crate::cameras::start_camera(&mut cameras, &id, &ffmpeg_bin).await
        .map_err(|e| e.to_string())?;
    
    app_handle.emit("camera-status-changed", CameraStatusPayload { id: id.clone(), status: "running".to_string() })
        .map_err(|e| e.to_string())?;
    
    Ok(format!("Camera {} started successfully", id))
}

/// Detiene una cámara específica
#[tauri::command]
pub async fn stop_camera(
    state: State<'_, AppState>,
    id: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut cameras = state.cameras.lock().await;
    crate::cameras::stop_camera(&mut cameras, &id)
        .map_err(|e| e.to_string())?;
    
    app_handle.emit("camera-status-changed", CameraStatusPayload { id: id.clone(), status: "stopped".to_string() })
        .map_err(|e| e.to_string())?;
    
    Ok(format!("Camera {} stopped successfully", id))
}

/// Reconecta una cámara (stop + start)
#[tauri::command]
pub async fn reconnect_camera(
    state: State<'_, AppState>,
    id: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let ffmpeg_bin = get_binary_path(&app_handle, "ffmpeg.exe")
        .map_err(|e| format!("FFmpeg binary not found: {}", e))?;
    
    let mut cameras = state.cameras.lock().await;
    crate::cameras::reconnect_camera(&mut cameras, &id, &ffmpeg_bin).await
        .map_err(|e| e.to_string())?;
    
    app_handle.emit("camera-status-changed", CameraStatusPayload { id: id.clone(), status: "running".to_string() })
        .map_err(|e| e.to_string())?;
    
    Ok(format!("Camera {} reconnected successfully", id))
}

/// Obtiene logs de un componente
#[tauri::command]
pub async fn get_logs(
    state: State<'_, AppState>,
    component: String,
    lines: Option<usize>,
) -> Result<Vec<String>, String> {
    let logs = state.logs.lock().await;
    let lines_to_get = lines.unwrap_or(100);
    Ok(logs.get_last(&component, lines_to_get))
}

// Payloads para eventos
#[derive(Clone, serde::Serialize)]
struct AgentStatusPayload {
    running: bool,
}

#[derive(Clone, serde::Serialize)]
struct CameraStatusPayload {
    id: String,
    status: String,
}
