use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Estructura para gestionar configuraciones
pub struct ConfigManager {
    pub config_dir: PathBuf,
    pub resource_dir: PathBuf,
}

impl ConfigManager {
    /// Crea nuevo ConfigManager obteniendo las rutas del app_handle
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self> {
        let config_dir = app_handle
            .path()
            .app_config_dir()
            .context("Failed to get app config dir")?;
        
        let resource_dir = app_handle
            .path()
            .resource_dir()
            .context("Failed to get resource dir")?;
        
        log::info!("Config dir: {:?}", config_dir);
        log::info!("Resource dir: {:?}", resource_dir);
        
        Ok(Self {
            config_dir,
            resource_dir,
        })
    }
    
    /// Inicializa todas las configuraciones necesarias
    pub fn initialize_configs(&self) -> Result<()> {
        // Crear directorio de config si no existe
        if !self.config_dir.exists() {
            fs::create_dir_all(&self.config_dir)
                .context("Failed to create config directory")?;
            log::info!("Created config directory: {:?}", self.config_dir);
        }
        
        // Lista de archivos de config a copiar
        let config_files = vec![
            "mediamtx.yml",
            "cameras.json",
            "config.json",
        ];
        
        for file_name in config_files {
            self.ensure_config_file(file_name)?;
        }
        
        Ok(())
    }
    
    /// Asegura que un archivo de config existe, copiando el default si no
    fn ensure_config_file(&self, file_name: &str) -> Result<()> {
        let target_path = self.config_dir.join(file_name);
        
        if target_path.exists() {
            log::debug!("Config file already exists: {:?}", target_path);
            return Ok(());
        }
        
        // Buscar en resources
        let source_path = self.resource_dir.join("config").join(file_name);
        
        if source_path.exists() {
            fs::copy(&source_path, &target_path)
                .with_context(|| format!("Failed to copy config {} to {:?}", file_name, target_path))?;
            log::info!("Copied default config: {} -> {:?}", file_name, target_path);
        } else {
            // Crear archivo default vacío o con contenido mínimo
            self.create_default_config(file_name, &target_path)?;
        }
        
        Ok(())
    }
    
    /// Crea un archivo de config por defecto
    fn create_default_config(&self, file_name: &str, target_path: &Path) -> Result<()> {
        let content = match file_name {
            "cameras.json" => r#"{
  "cameras": []
}"#,
            "config.json" => r#"{
  "autoStartAgent": false,
  "autoStartCameras": true,
  "tunnelEnabled": false,
  "tunnelMode": "quick"
}"#,
            "mediamtx.yml" => include_str!("../config/mediamtx.yml"),
            _ => "",
        };
        
        fs::write(target_path, content)
            .with_context(|| format!("Failed to create default config: {}", file_name))?;
        log::info!("Created default config: {:?}", target_path);
        
        Ok(())
    }
    
    /// Obtiene la ruta de un archivo de configuración
    pub fn get_config_path(&self, file_name: &str) -> PathBuf {
        self.config_dir.join(file_name)
    }
    
    /// Obtiene la ruta de un binario
    pub fn get_binary_path(&self, binary_name: &str) -> Result<PathBuf> {
        let bin_path = self.resource_dir.join("bin").join(binary_name);
        
        if !bin_path.exists() {
            // En desarrollo, buscar en src-tauri/bin
            let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin").join(binary_name);
            if dev_path.exists() {
                log::info!("Using dev binary: {:?}", dev_path);
                return Ok(dev_path);
            }
            return Err(anyhow::anyhow!("Binary not found: {} (checked {:?} and {:?})", 
                binary_name, bin_path, dev_path));
        }
        
        Ok(bin_path)
    }
}

/// Detecta si hay un tunnel de cloudflared configurado en el sistema
pub fn detect_cloudflared_tunnel() -> Option<CloudflaredTunnelInfo> {
    let home = dirs::home_dir()?;
    let cloudflared_dir = home.join(".cloudflared");
    
    if !cloudflared_dir.exists() {
        log::info!("No .cloudflared directory found");
        return None;
    }
    
    // Buscar cert.pem (indica que está autenticado)
    let cert_path = cloudflared_dir.join("cert.pem");
    let is_authenticated = cert_path.exists();
    
    // Buscar archivos de credenciales de túnel (*.json)
    let mut tunnels = Vec::new();
    if let Ok(entries) = fs::read_dir(&cloudflared_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Some(tunnel_id) = path.file_stem().and_then(|s| s.to_str()) {
                    // Verificar que parece un UUID (tunnel ID)
                    if tunnel_id.contains('-') && tunnel_id.len() > 30 {
                        tunnels.push(TunnelCredentials {
                            tunnel_id: tunnel_id.to_string(),
                            credentials_file: path.clone(),
                        });
                    }
                }
            }
        }
    }
    
    Some(CloudflaredTunnelInfo {
        cloudflared_dir,
        is_authenticated,
        tunnels,
    })
}

#[derive(Debug, Clone)]
pub struct CloudflaredTunnelInfo {
    pub cloudflared_dir: PathBuf,
    pub is_authenticated: bool,
    pub tunnels: Vec<TunnelCredentials>,
}

#[derive(Debug, Clone)]
pub struct TunnelCredentials {
    pub tunnel_id: String,
    pub credentials_file: PathBuf,
}

/// Genera un archivo de config de cloudflared para un túnel existente
pub fn generate_cloudflared_config(
    tunnel_id: &str,
    credentials_file: &Path,
    hostname: Option<&str>,
    target_port: u16,
    output_path: &Path,
) -> Result<()> {
    let hostname_section = if let Some(host) = hostname {
        format!(r#"
ingress:
  - hostname: {}
    service: http://localhost:{}
  - service: http_status:404
"#, host, target_port)
    } else {
        format!(r#"
ingress:
  - service: http://localhost:{}
"#, target_port)
    };
    
    let config = format!(r#"# Cloudflared Tunnel Configuration
# Auto-generated by Stream Agent

tunnel: {}
credentials-file: {}
{}
"#, tunnel_id, credentials_file.display(), hostname_section);
    
    fs::write(output_path, config)
        .context("Failed to write cloudflared config")?;
    
    log::info!("Generated cloudflared config at {:?}", output_path);
    Ok(())
}
