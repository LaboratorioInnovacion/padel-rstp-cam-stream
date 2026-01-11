use crate::app_state::{ProcessHandle, ProcessStatus, ReconnectPolicy, ReconnectStats};
use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;
use tauri::Manager;
use tokio::time::sleep;

/// Inicia MediaMTX
pub fn start_mediamtx(bin_path: &Path, config_path: &Path) -> Result<ProcessHandle> {
    log::info!("Starting MediaMTX from: {:?}", bin_path);
    
    let mut cmd = Command::new(bin_path);
    cmd.arg(config_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = cmd.spawn()
        .context("Failed to spawn MediaMTX process")?;

    log::info!("MediaMTX started with PID: {:?}", child.id());
    Ok(ProcessHandle::new("mediamtx".to_string(), child))
}

/// Inicia Cloudflared túnel con archivo de configuración
pub fn start_cloudflared(bin_path: &Path, config_path: &Path) -> Result<ProcessHandle> {
    log::info!("Starting Cloudflared from: {:?} with config: {:?}", bin_path, config_path);
    
    let mut cmd = Command::new(bin_path);
    cmd.arg("tunnel")
        .arg("--config")
        .arg(config_path)
        .arg("run")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = cmd.spawn()
        .context("Failed to spawn Cloudflared process")?;

    log::info!("Cloudflared started with PID: {:?}", child.id());
    Ok(ProcessHandle::new("cloudflared".to_string(), child))
}

/// Inicia Cloudflared en modo Quick Tunnel (sin configuración previa)
/// Esto crea un túnel temporal con URL automática tipo: https://random-words.trycloudflare.com
pub fn start_cloudflared_quick_tunnel(bin_path: &Path, local_port: u16) -> Result<ProcessHandle> {
    log::info!("Starting Cloudflared Quick Tunnel to localhost:{}", local_port);
    
    // cloudflared tunnel --url http://localhost:8888
    let mut cmd = Command::new(bin_path);
    cmd.arg("tunnel")
        .arg("--url")
        .arg(format!("http://localhost:{}", local_port))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = cmd.spawn()
        .context("Failed to spawn Cloudflared quick tunnel")?;

    log::info!("Cloudflared Quick Tunnel started with PID: {:?}", child.id());
    log::info!("Check stderr output for the tunnel URL (*.trycloudflare.com)");
    Ok(ProcessHandle::new("cloudflared-quick".to_string(), child))
}

/// Inicia FFmpeg para una cámara específica
pub fn start_ffmpeg(
    bin_path: &Path,
    camera_id: &str,
    rtsp_url: &str,
    encoding: &crate::app_state::EncodingMode,
    quality: &crate::app_state::QualityPreset,
    audio_mode: &crate::app_state::AudioMode,
) -> Result<ProcessHandle> {
    log::info!("Starting FFmpeg for camera: {}", camera_id);
    
    let output_url = format!("rtsp://localhost:8554/{}", camera_id);
    let args = build_ffmpeg_args(rtsp_url, &output_url, encoding, quality, audio_mode);
    
    let mut cmd = Command::new(bin_path);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let child = cmd.spawn()
        .with_context(|| format!("Failed to spawn FFmpeg for camera {}", camera_id))?;

    log::info!("FFmpeg for {} started with PID: {:?}", camera_id, child.id());
    Ok(ProcessHandle::new(format!("ffmpeg-{}", camera_id), child))
}

/// Genera argumentos para FFmpeg según configuración
fn build_ffmpeg_args(
    input_url: &str,
    output_url: &str,
    encoding: &crate::app_state::EncodingMode,
    quality: &crate::app_state::QualityPreset,
    audio_mode: &crate::app_state::AudioMode,
) -> Vec<String> {
    let mut args = vec![
        "-rtsp_transport".to_string(),
        "tcp".to_string(),
        "-rtsp_flags".to_string(),
        "prefer_tcp".to_string(),
        "-fflags".to_string(),
        "+genpts+discardcorrupt".to_string(),
        "-analyzeduration".to_string(),
        "5000000".to_string(),
        "-probesize".to_string(),
        "5000000".to_string(),
        "-i".to_string(),
        input_url.to_string(),
    ];

    match encoding {
        crate::app_state::EncodingMode::Copy => {
            // Copy mode: sin recodificación
            args.extend(vec![
                "-c".to_string(),
                "copy".to_string(),
            ]);
        }
        crate::app_state::EncodingMode::Transcode => {
            // Transcode mode: recodificar según quality
            let (resolution, bitrate, fps, gop, preset) = match quality {
                crate::app_state::QualityPreset::Low => ("640:360", "1000k", "15", "30", "fast"),
                crate::app_state::QualityPreset::Medium => ("1280:720", "2500k", "25", "50", "medium"),
                crate::app_state::QualityPreset::High => ("1920:1080", "5000k", "30", "60", "medium"),
            };

            let max_bitrate = format!("{}k", (bitrate.trim_end_matches('k').parse::<u32>().unwrap() as f32 * 1.2) as u32);
            let bufsize = format!("{}k", (bitrate.trim_end_matches('k').parse::<u32>().unwrap() * 4));

            args.extend(vec![
                "-vf".to_string(),
                format!("scale={}:force_original_aspect_ratio=decrease,fps={}", resolution, fps),
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                preset.to_string(),
                "-b:v".to_string(),
                bitrate.to_string(),
                "-maxrate".to_string(),
                max_bitrate,
                "-bufsize".to_string(),
                bufsize,
                "-g".to_string(),
                gop.to_string(),
                "-keyint_min".to_string(),
                gop.to_string(),
                "-sc_threshold".to_string(),
                "0".to_string(),
                "-pix_fmt".to_string(),
                "yuv420p".to_string(),
            ]);

            // Audio según configuración
            match audio_mode {
                crate::app_state::AudioMode::Disabled => {
                    args.extend(vec!["-an".to_string()]);
                }
                crate::app_state::AudioMode::Copy => {
                    args.extend(vec!["-c:a".to_string(), "copy".to_string()]);
                }
                crate::app_state::AudioMode::Transcode => {
                    args.extend(vec![
                        "-c:a".to_string(),
                        "aac".to_string(),
                        "-b:a".to_string(),
                        "128k".to_string(),
                        "-ar".to_string(),
                        "44100".to_string(),
                    ]);
                }
            }
        }
    }

    // Output final
    args.extend(vec![
        "-f".to_string(),
        "rtsp".to_string(),
        "-rtsp_transport".to_string(),
        "tcp".to_string(),
        output_url.to_string(),
    ]);

    args
}

/// Detiene un proceso de manera segura
pub fn stop_process(handle: &mut ProcessHandle) -> Result<()> {
    if let Some(mut child) = handle.child.take() {
        log::info!("Stopping process: {}", handle.name);
        
        // Intentar kill
        match child.kill() {
            Ok(_) => {
                let _ = child.wait();
                log::info!("Process {} stopped successfully", handle.name);
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to kill process {}: {}", handle.name, e);
                Err(anyhow::anyhow!("Failed to kill process: {}", e))
            }
        }
    } else {
        Ok(())
    }
}

/// Verifica si un proceso sigue ejecutándose
pub fn is_process_running(handle: &mut ProcessHandle) -> bool {
    if let Some(child) = &mut handle.child {
        match child.try_wait() {
            Ok(Some(_status)) => {
                // Proceso terminó
                false
            }
            Ok(None) => {
                // Proceso sigue corriendo
                true
            }
            Err(_e) => {
                // Error al verificar, asumir que no está corriendo
                false
            }
        }
    } else {
        false
    }
}

/// Monitorea y reinicia un proceso según política de reconexión
pub async fn monitor_and_reconnect<F, Fut>(
    name: String,
    policy: ReconnectPolicy,
    stats: &mut ReconnectStats,
    status: &mut ProcessStatus,
    start_fn: F,
) -> Result<ProcessHandle>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<ProcessHandle>>,
{
    if !policy.enabled {
        return start_fn().await;
    }

    let mut attempts = 0;
    let mut current_delay = policy.retry_delay_ms;

    loop {
        match start_fn().await {
            Ok(handle) => {
                stats.record_success();
                *status = ProcessStatus::Running;
                log::info!("{} started successfully", name);
                return Ok(handle);
            }
            Err(e) => {
                attempts += 1;
                stats.record_restart();
                *status = ProcessStatus::Reconnecting;
                
                log::warn!(
                    "{} failed to start (attempt {}/{}): {}",
                    name, attempts, policy.max_retries, e
                );

                if attempts >= policy.max_retries {
                    *status = ProcessStatus::Failed;
                    return Err(anyhow::anyhow!(
                        "{} failed after {} attempts",
                        name, attempts
                    ));
                }

                // Backoff exponencial
                log::info!("{} waiting {}ms before retry...", name, current_delay);
                sleep(Duration::from_millis(current_delay)).await;
                
                current_delay = (current_delay as f32 * policy.backoff_multiplier) as u64;
                current_delay = current_delay.min(policy.max_delay_ms);
            }
        }
    }
}

/// Obtiene la ruta de un binario desde resources
pub fn get_binary_path(app_handle: &tauri::AppHandle, binary_name: &str) -> Result<PathBuf> {
    let resource_path = app_handle
        .path()
        .resource_dir()
        .context("Failed to get resource dir")?;
    
    let bin_path = resource_path.join("bin").join(binary_name);
    
    if !bin_path.exists() {
        return Err(anyhow::anyhow!("Binary not found: {:?}", bin_path));
    }
    
    Ok(bin_path)
}

/// Obtiene la ruta de configuración
pub fn get_config_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
    let config_dir = app_handle
        .path()
        .app_config_dir()
        .context("Failed to get config dir")?;
    
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir)
            .context("Failed to create config directory")?;
    }
    
    Ok(config_dir)
}

/// Obtiene la ruta de logs
pub fn get_log_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
    let log_dir = app_handle
        .path()
        .app_log_dir()
        .context("Failed to get log dir")?;
    
    if !log_dir.exists() {
        std::fs::create_dir_all(&log_dir)
            .context("Failed to create log directory")?;
    }
    
    Ok(log_dir)
}
