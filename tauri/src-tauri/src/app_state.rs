use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Child;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::Mutex;
use chrono::{DateTime, Utc};

/// Estado global de la aplicación
#[derive(Clone)]
pub struct AppState {
    pub cameras: Arc<Mutex<HashMap<String, CameraRuntime>>>,
    pub mediamtx_process: Arc<Mutex<Option<ProcessHandle>>>,
    pub cloudflared_process: Arc<Mutex<Option<ProcessHandle>>>,
    pub config: Arc<Mutex<AgentConfig>>,
    pub is_running: Arc<Mutex<bool>>,
    pub logs: Arc<Mutex<LogBuffer>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            cameras: Arc::new(Mutex::new(HashMap::new())),
            mediamtx_process: Arc::new(Mutex::new(None)),
            cloudflared_process: Arc::new(Mutex::new(None)),
            config: Arc::new(Mutex::new(AgentConfig::default())),
            is_running: Arc::new(Mutex::new(false)),
            logs: Arc::new(Mutex::new(LogBuffer::new())),
        }
    }
}

/// Configuración de una cámara
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraConfig {
    pub id: String,
    pub name: String,
    pub rtsp_url: String,
    pub enabled: bool,
    #[serde(default = "default_encoding")]
    pub encoding: EncodingMode,
    #[serde(default = "default_quality")]
    pub quality: QualityPreset,
    #[serde(default = "default_audio")]
    pub audio_mode: AudioMode,
}

fn default_encoding() -> EncodingMode {
    EncodingMode::Copy
}

fn default_quality() -> QualityPreset {
    QualityPreset::Medium
}

fn default_audio() -> AudioMode {
    AudioMode::Copy
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EncodingMode {
    Copy,
    Transcode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum QualityPreset {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AudioMode {
    Disabled,
    Copy,
    Transcode,
}

/// Estado runtime de una cámara
pub struct CameraRuntime {
    pub config: CameraConfig,
    pub process: Option<ProcessHandle>,
    pub status: ProcessStatus,
    pub stats: ReconnectStats,
    pub reconnect_policy: ReconnectPolicy,
}

impl CameraRuntime {
    pub fn new(config: CameraConfig) -> Self {
        Self {
            config,
            process: None,
            status: ProcessStatus::Stopped,
            stats: ReconnectStats::default(),
            reconnect_policy: ReconnectPolicy::default(),
        }
    }
}

/// Handle a un proceso externo
#[derive(Debug)]
pub struct ProcessHandle {
    pub child: Option<Child>,
    pub pid: Option<u32>,
    pub started_at: SystemTime,
    pub name: String,
}

impl ProcessHandle {
    pub fn new(name: String, child: Child) -> Self {
        let pid = child.id();
        Self {
            child: Some(child),
            pid: Some(pid),
            started_at: SystemTime::now(),
            name,
        }
    }

    pub fn uptime(&self) -> Duration {
        SystemTime::now()
            .duration_since(self.started_at)
            .unwrap_or(Duration::from_secs(0))
    }
}

/// Estado de un proceso
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Stopped,
    Running,
    Reconnecting,
    Failed,
}

/// Política de reconexión
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconnectPolicy {
    pub enabled: bool,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub backoff_multiplier: f32,
    pub max_delay_ms: u64,
    pub reset_counter_after_ms: u64,
}

impl Default for ReconnectPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            max_retries: 10,
            retry_delay_ms: 3000,
            backoff_multiplier: 2.0,
            max_delay_ms: 60000,
            reset_counter_after_ms: 300000, // 5 minutos
        }
    }
}

/// Estadísticas de reconexión
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReconnectStats {
    pub restarts: u32,
    pub last_restart: Option<DateTime<Utc>>,
    pub last_stable_time: Option<DateTime<Utc>>,
    pub consecutive_failures: u32,
    pub total_uptime_secs: u64,
}

impl ReconnectStats {
    pub fn record_restart(&mut self) {
        self.restarts += 1;
        self.consecutive_failures += 1;
        self.last_restart = Some(Utc::now());
    }

    pub fn record_success(&mut self) {
        self.consecutive_failures = 0;
        self.last_stable_time = Some(Utc::now());
    }

    pub fn should_reset_counter(&self, policy: &ReconnectPolicy) -> bool {
        if let Some(last_stable) = self.last_stable_time {
            let elapsed = Utc::now().signed_duration_since(last_stable);
            elapsed.num_milliseconds() as u64 >= policy.reset_counter_after_ms
        } else {
            false
        }
    }
}

/// Configuración general del agente
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub server_url: String,
    pub location_id: String,
    pub location_name: String,
    pub tunnel_name: String,
    pub tunnel_id: Option<String>,
    pub tunnel_hostname: Option<String>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            server_url: "https://padel.noaservice.org".to_string(),
            location_id: "1".to_string(),
            location_name: "Ubicación Principal".to_string(),
            tunnel_name: "stream-agent".to_string(),
            tunnel_id: None,
            tunnel_hostname: None,
        }
    }
}

/// Estado general del agente
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub running: bool,
    pub mediamtx_running: bool,
    pub cloudflared_running: bool,
    pub cameras_running: u32,
    pub cameras_total: u32,
    pub tunnel_url: Option<String>,
    pub uptime_secs: u64,
}

/// Listado de cámaras para serialización
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraList {
    pub cameras: Vec<CameraInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraInfo {
    pub id: String,
    pub name: String,
    pub rtsp_url: String,
    pub enabled: bool,
    pub encoding: EncodingMode,
    pub quality: QualityPreset,
    pub audio_mode: AudioMode,
    pub status: ProcessStatus,
    pub restarts: u32,
    pub last_restart: Option<DateTime<Utc>>,
}

/// Buffer circular de logs
pub struct LogBuffer {
    max_lines: usize,
    logs: HashMap<String, Vec<String>>,
}

impl LogBuffer {
    pub fn new() -> Self {
        Self {
            max_lines: 1000,
            logs: HashMap::new(),
        }
    }

    pub fn append(&mut self, component: String, line: String) {
        let entry = self.logs.entry(component).or_insert_with(Vec::new);
        entry.push(line);
        if entry.len() > self.max_lines {
            entry.remove(0);
        }
    }

    pub fn get(&self, component: &str) -> Option<&Vec<String>> {
        self.logs.get(component)
    }

    pub fn get_last(&self, component: &str, n: usize) -> Vec<String> {
        if let Some(logs) = self.logs.get(component) {
            logs.iter().rev().take(n).rev().cloned().collect()
        } else {
            Vec::new()
        }
    }
}

/// Configuración de cámaras persistida
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CamerasConfigFile {
    pub cameras: Vec<CameraConfig>,
}

impl Default for CamerasConfigFile {
    fn default() -> Self {
        Self {
            cameras: vec![],
        }
    }
}
