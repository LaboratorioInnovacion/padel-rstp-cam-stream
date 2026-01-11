mod app_state;
mod cameras;
mod commands;
mod config_manager;
mod supervisor;

use app_state::AppState;
use config_manager::ConfigManager;
use tauri::{Manager, Wry};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Inicializar logger
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    log::info!("Starting Stream Agent...");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Inicializar configuraciones (copiar defaults si no existen)
            match ConfigManager::new(&app.handle()) {
                Ok(config_mgr) => {
                    if let Err(e) = config_mgr.initialize_configs() {
                        log::error!("Failed to initialize configs: {}", e);
                    } else {
                        log::info!("Configurations initialized successfully");
                    }
                    
                    // Detectar tunnels existentes de cloudflared
                    if let Some(tunnel_info) = config_manager::detect_cloudflared_tunnel() {
                        log::info!("Cloudflared detected:");
                        log::info!("  - Authenticated: {}", tunnel_info.is_authenticated);
                        log::info!("  - Tunnels found: {}", tunnel_info.tunnels.len());
                        for tunnel in &tunnel_info.tunnels {
                            log::info!("    - Tunnel ID: {}", tunnel.tunnel_id);
                        }
                    } else {
                        log::info!("No cloudflared configuration found on this system");
                    }
                }
                Err(e) => {
                    log::error!("Failed to create ConfigManager: {}", e);
                }
            }
            
            // Inicializar estado global
            let app_state = AppState::new();
            app.manage(app_state);

            // Configurar system tray
            setup_system_tray(app)?;

            log::info!("Stream Agent initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_agent,
            commands::stop_agent,
            commands::get_agent_status,
            commands::list_cameras,
            commands::add_camera,
            commands::update_camera,
            commands::remove_camera,
            commands::start_camera,
            commands::stop_camera,
            commands::reconnect_camera,
            commands::get_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_system_tray(app: &mut tauri::App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    
    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                log::info!("Quitting application from tray");
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button, .. } = event {
                if button == tauri::tray::MouseButton::Left {
                    if let Some(app) = tray.app_handle().get_webview_window("main") {
                        let _ = app.show();
                        let _ = app.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
