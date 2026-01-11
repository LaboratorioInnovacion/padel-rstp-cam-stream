use crate::app_state::*;
use crate::supervisor::{start_ffmpeg, stop_process, is_process_running, reconnect_with_backoff};
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::Path;

/// Agrega una nueva cámara a la configuración
pub fn add_camera(
    cameras: &mut HashMap<String, CameraRuntime>,
    config: CameraConfig,
) -> Result<()> {
    let id = config.id.clone();
    
    if cameras.contains_key(&id) {
        return Err(anyhow::anyhow!("Camera with id '{}' already exists", id));
    }
    
    log::info!("Adding camera: {} ({})", config.name, id);
    let runtime = CameraRuntime::new(config);
    cameras.insert(id, runtime);
    
    Ok(())
}

/// Actualiza la configuración de una cámara existente
pub fn update_camera(
    cameras: &mut HashMap<String, CameraRuntime>,
    id: &str,
    updated_config: CameraConfig,
) -> Result<()> {
    let runtime = cameras.get_mut(id)
        .ok_or_else(|| anyhow::anyhow!("Camera '{}' not found", id))?;
    
    log::info!("Updating camera: {}", id);
    
    // Si está corriendo, necesita reinicio
    let was_running = runtime.status == ProcessStatus::Running;
    
    runtime.config = updated_config;
    
    if was_running {
        log::warn!("Camera {} was running, requires restart for changes to take effect", id);
    }
    
    Ok(())
}

/// Elimina una cámara
pub fn remove_camera(
    cameras: &mut HashMap<String, CameraRuntime>,
    id: &str,
) -> Result<()> {
    let mut runtime = cameras.remove(id)
        .ok_or_else(|| anyhow::anyhow!("Camera '{}' not found", id))?;
    
    log::info!("Removing camera: {}", id);
    
    // Detener proceso si está corriendo
    if let Some(handle) = &mut runtime.process {
        stop_process(handle)?;
    }
    
    Ok(())
}

/// Inicia el proceso FFmpeg de una cámara
pub async fn start_camera(
    cameras: &mut HashMap<String, CameraRuntime>,
    id: &str,
    ffmpeg_path: &Path,
) -> Result<()> {
    let runtime = cameras.get_mut(id)
        .ok_or_else(|| anyhow::anyhow!("Camera '{}' not found", id))?;
    
    if !runtime.config.enabled {
        return Err(anyhow::anyhow!("Camera '{}' is disabled", id));
    }
    
    if runtime.status == ProcessStatus::Running {
        return Err(anyhow::anyhow!("Camera '{}' is already running", id));
    }
    
    log::info!("Starting camera: {}", id);
    
    let camera_id = runtime.config.id.clone();
    let rtsp_url = runtime.config.rtsp_url.clone();
    let encoding = runtime.config.encoding.clone();
    let quality = runtime.config.quality.clone();
    let audio_mode = runtime.config.audio_mode.clone();
    let ffmpeg_path = ffmpeg_path.to_path_buf();
    
    // Usar reconexión con backoff
    let policy = runtime.reconnect_policy.clone();
    let stats = &mut runtime.stats;
    let status = &mut runtime.status;
    
    let handle = reconnect_with_backoff(
        &format!("Camera {}", id),
        &policy,
        stats,
        || {
            let ffmpeg_path = ffmpeg_path.clone();
            let camera_id = camera_id.clone();
            let rtsp_url = rtsp_url.clone();
            let encoding = encoding.clone();
            let quality = quality.clone();
            let audio_mode = audio_mode.clone();
            
            async move {
                start_ffmpeg(
                    &ffmpeg_path,
                    &camera_id,
                    &rtsp_url,
                    &encoding,
                    &quality,
                    &audio_mode,
                )
            }
        }
    ).await?;
    
    runtime.process = Some(handle);
    runtime.status = ProcessStatus::Running;
    
    log::info!("Camera {} started successfully", id);
    Ok(())
}

/// Detiene el proceso FFmpeg de una cámara
pub fn stop_camera(
    cameras: &mut HashMap<String, CameraRuntime>,
    id: &str,
) -> Result<()> {
    let runtime = cameras.get_mut(id)
        .ok_or_else(|| anyhow::anyhow!("Camera '{}' not found", id))?;
    
    // Si ya está detenida, simplemente retornar Ok (no es error)
    if runtime.status == ProcessStatus::Stopped {
        log::debug!("Camera '{}' is already stopped, skipping", id);
        return Ok(());
    }
    
    log::info!("Stopping camera: {}", id);
    
    if let Some(handle) = &mut runtime.process {
        stop_process(handle)?;
    }
    
    runtime.process = None;
    runtime.status = ProcessStatus::Stopped;
    
    log::info!("Camera {} stopped successfully", id);
    Ok(())
}

/// Reinicia una cámara (stop + start)
pub async fn reconnect_camera(
    cameras: &mut HashMap<String, CameraRuntime>,
    id: &str,
    ffmpeg_path: &Path,
) -> Result<()> {
    log::info!("Reconnecting camera: {}", id);
    
    // Detener si está corriendo
    if let Ok(_) = stop_camera(cameras, id) {
        log::info!("Camera {} stopped for reconnection", id);
    }
    
    // Pequeño delay antes de reiniciar
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Iniciar nuevamente
    start_camera(cameras, id, ffmpeg_path).await?;
    
    log::info!("Camera {} reconnected successfully", id);
    Ok(())
}

/// Lista todas las cámaras con su información
pub fn list_cameras(cameras: &HashMap<String, CameraRuntime>) -> Vec<CameraInfo> {
    cameras.iter().map(|(_, runtime)| {
        CameraInfo {
            id: runtime.config.id.clone(),
            name: runtime.config.name.clone(),
            rtsp_url: runtime.config.rtsp_url.clone(),
            enabled: runtime.config.enabled,
            encoding: runtime.config.encoding.clone(),
            quality: runtime.config.quality.clone(),
            audio_mode: runtime.config.audio_mode.clone(),
            status: runtime.status.clone(),
            restarts: runtime.stats.restarts,
            last_restart: runtime.stats.last_restart,
        }
    }).collect()
}

/// Verifica el estado de todos los procesos de cámaras
pub fn check_cameras_health(cameras: &mut HashMap<String, CameraRuntime>) {
    for (id, runtime) in cameras.iter_mut() {
        if runtime.status == ProcessStatus::Running {
            if let Some(handle) = &mut runtime.process {
                if !is_process_running(handle) {
                    log::warn!("Camera {} process died unexpectedly", id);
                    runtime.status = ProcessStatus::Failed;
                    runtime.process = None;
                }
            }
        }
    }
}

/// Detiene todas las cámaras en ejecución
pub fn stop_all_cameras(cameras: &mut HashMap<String, CameraRuntime>) -> Result<()> {
    log::info!("Stopping all cameras");
    
    let camera_ids: Vec<String> = cameras.keys().cloned().collect();
    
    for id in camera_ids {
        if let Err(e) = stop_camera(cameras, &id) {
            log::error!("Failed to stop camera {}: {}", id, e);
        }
    }
    
    Ok(())
}

/// Carga configuración de cámaras desde archivo
pub fn load_cameras_config(config_path: &Path) -> Result<Vec<CameraConfig>> {
    if !config_path.exists() {
        log::warn!("Cameras config file not found: {:?}", config_path);
        return Ok(Vec::new());
    }
    
    let content = std::fs::read_to_string(config_path)
        .context("Failed to read cameras config")?;
    
    let config_file: CamerasConfigFile = serde_json::from_str(&content)
        .context("Failed to parse cameras config")?;
    
    log::info!("Loaded {} cameras from config", config_file.cameras.len());
    Ok(config_file.cameras)
}

/// Guarda configuración de cámaras a archivo
pub fn save_cameras_config(
    cameras: &HashMap<String, CameraRuntime>,
    config_path: &Path,
) -> Result<()> {
    let configs: Vec<CameraConfig> = cameras.values()
        .map(|runtime| runtime.config.clone())
        .collect();
    
    let config_file = CamerasConfigFile { cameras: configs };
    
    let content = serde_json::to_string_pretty(&config_file)
        .context("Failed to serialize cameras config")?;
    
    std::fs::write(config_path, content)
        .context("Failed to write cameras config")?;
    
    log::info!("Saved {} cameras to config", config_file.cameras.len());
    Ok(())
}

/// Inicializa cámaras desde configuración guardada
pub async fn init_cameras_from_config(
    cameras: &mut HashMap<String, CameraRuntime>,
    config_path: &Path,
    ffmpeg_path: &Path,
    auto_start: bool,
) -> Result<usize> {
    let configs = load_cameras_config(config_path)?;
    let total = configs.len();
    let mut started = 0;
    
    for config in configs {
        let id = config.id.clone();
        let enabled = config.enabled;
        add_camera(cameras, config)?;
        
        if auto_start && enabled {
            log::info!("Auto-starting camera: {}", id);
            match start_camera(cameras, &id, ffmpeg_path).await {
                Ok(_) => {
                    started += 1;
                    log::info!("Camera {} started successfully", id);
                }
                Err(e) => {
                    log::error!("Failed to auto-start camera {}: {}", id, e);
                }
            }
        }
    }
    
    log::info!("Initialized {}/{} cameras (started: {})", total, total, started);
    Ok(total)
}
