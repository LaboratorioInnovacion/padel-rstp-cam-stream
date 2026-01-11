import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

interface AgentStatus {
  running: boolean;
  mediamtx_running: boolean;
  cloudflared_running: boolean;
  cameras_running: number;
  cameras_total: number;
  tunnel_url: string | null;
  uptime_secs: number;
}

interface CameraInfo {
  id: string;
  name: string;
  rtspUrl: string;
  enabled: boolean;
  encoding: string;
  quality: string;
  audioMode: string;
  status: string;
  restarts: number;
  last_restart: string | null;
}

interface NewCamera {
  id: string;
  name: string;
  rtspUrl: string;
  enabled: boolean;
  encoding: "copy" | "transcode";
  quality: "low" | "medium" | "high";
  audioMode: "disabled" | "copy" | "transcode";
}

type TabType = "status" | "cameras" | "logs" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("status");
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [newCamera, setNewCamera] = useState<NewCamera>({
    id: "",
    name: "",
    rtspUrl: "rtsp://",
    enabled: true,
    encoding: "copy",
    quality: "medium",
    audioMode: "copy",
  });

  // Auto-clear messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Load status
  const loadStatus = useCallback(async () => {
    try {
      const status = await invoke<AgentStatus>("get_agent_status");
      setAgentStatus(status);
    } catch (error) {
      console.error("Failed to load status:", error);
    }
  }, []);

  // Load cameras
  const loadCameras = useCallback(async () => {
    try {
      const cams = await invoke<CameraInfo[]>("list_cameras");
      setCameras(cams);
    } catch (error) {
      console.error("Failed to load cameras:", error);
    }
  }, []);

  // Load logs
  const loadLogs = useCallback(async () => {
    try {
      const logLines = await invoke<string[]>("get_logs", { component: "agent", lines: 100 });
      setLogs(logLines);
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  }, []);

  // Initial load and event listeners
  useEffect(() => {
    loadStatus();
    loadCameras();

    const unlisten1 = listen("agent-status-changed", () => {
      loadStatus();
    });

    const unlisten2 = listen("cameras-updated", () => {
      loadCameras();
    });

    const unlisten3 = listen("camera-status-changed", () => {
      loadCameras();
    });

    // Polling every 3 seconds
    const interval = setInterval(() => {
      loadStatus();
      if (activeTab === "cameras") loadCameras();
      if (activeTab === "logs") loadLogs();
    }, 3000);

    return () => {
      clearInterval(interval);
      unlisten1.then((fn) => fn());
      unlisten2.then((fn) => fn());
      unlisten3.then((fn) => fn());
    };
  }, [activeTab, loadStatus, loadCameras, loadLogs]);

  // Agent controls
  const handleStartAgent = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await invoke<string>("start_agent");
      setMessage({ type: "success", text: result });
      await loadStatus();
      await loadCameras();
    } catch (error) {
      setMessage({ type: "error", text: `${error}` });
    } finally {
      setLoading(false);
    }
  };

  const handleStopAgent = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await invoke<string>("stop_agent");
      setMessage({ type: "success", text: result });
      await loadStatus();
      await loadCameras();
    } catch (error) {
      setMessage({ type: "error", text: `${error}` });
    } finally {
      setLoading(false);
    }
  };

  // Camera controls
  const handleStartCamera = async (id: string) => {
    setLoading(true);
    try {
      const result = await invoke<string>("start_camera", { id });
      setMessage({ type: "success", text: result });
      await loadCameras();
    } catch (error) {
      setMessage({ type: "error", text: `${error}` });
    } finally {
      setLoading(false);
    }
  };

  const handleStopCamera = async (id: string) => {
    setLoading(true);
    try {
      const result = await invoke<string>("stop_camera", { id });
      setMessage({ type: "success", text: result });
      await loadCameras();
    } catch (error) {
      setMessage({ type: "error", text: `${error}` });
    } finally {
      setLoading(false);
    }
  };

  const handleReconnectCamera = async (id: string) => {
    setLoading(true);
    try {
      const result = await invoke<string>("reconnect_camera", { id });
      setMessage({ type: "success", text: result });
      await loadCameras();
    } catch (error) {
      setMessage({ type: "error", text: `${error}` });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCamera = async (id: string) => {
    if (!confirm(`¿Eliminar cámara ${id}?`)) return;
    setLoading(true);
    try {
      const result = await invoke<string>("remove_camera", { id });
      setMessage({ type: "success", text: result });
      await loadCameras();
    } catch (error) {
      setMessage({ type: "error", text: `${error}` });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCamera.id || !newCamera.name || !newCamera.rtspUrl) {
      setMessage({ type: "error", text: "Completa todos los campos requeridos" });
      return;
    }
    setLoading(true);
    try {
      const result = await invoke<string>("add_camera", { camera: newCamera });
      setMessage({ type: "success", text: result });
      setShowAddCamera(false);
      setNewCamera({
        id: "",
        name: "",
        rtspUrl: "rtsp://",
        enabled: true,
        encoding: "copy",
        quality: "medium",
        audioMode: "copy",
      });
      await loadCameras();
    } catch (error) {
      setMessage({ type: "error", text: `${error}` });
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const getStatusClass = (running: boolean) => running ? "status-running" : "status-stopped";

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>🎥 Stream Agent</h1>
        <div className="header-status">
          {agentStatus && (
            <>
              <span className={`indicator ${agentStatus.running ? "on" : "off"}`} />
              <span>{agentStatus.running ? "Online" : "Offline"}</span>
            </>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tabs">
        <button
          className={activeTab === "status" ? "active" : ""}
          onClick={() => setActiveTab("status")}
        >
          📊 Estado
        </button>
        <button
          className={activeTab === "cameras" ? "active" : ""}
          onClick={() => setActiveTab("cameras")}
        >
          📷 Cámaras ({cameras.length})
        </button>
        <button
          className={activeTab === "logs" ? "active" : ""}
          onClick={() => { setActiveTab("logs"); loadLogs(); }}
        >
          📜 Logs
        </button>
        <button
          className={activeTab === "settings" ? "active" : ""}
          onClick={() => setActiveTab("settings")}
        >
          ⚙️ Config
        </button>
      </nav>

      {/* Messages */}
      {message && (
        <div className={`message message-${message.type}`}>
          {message.type === "error" ? "❌" : message.type === "success" ? "✅" : "ℹ️"} {message.text}
        </div>
      )}

      {/* Main Content */}
      <main className="content">
        {/* Status Tab */}
        {activeTab === "status" && (
          <div className="tab-content">
            <section className="card">
              <h2>Control del Agente</h2>
              <div className="controls">
                <button
                  onClick={handleStartAgent}
                  disabled={loading || agentStatus?.running}
                  className="btn btn-start"
                >
                  {loading ? "..." : "▶ Iniciar Agente"}
                </button>
                <button
                  onClick={handleStopAgent}
                  disabled={loading || !agentStatus?.running}
                  className="btn btn-stop"
                >
                  {loading ? "..." : "⏹ Detener Agente"}
                </button>
              </div>
            </section>

            <section className="card">
              <h2>Estado de Servicios</h2>
              {agentStatus ? (
                <div className="services-grid">
                  <div className="service-card">
                    <div className="service-icon">🖥️</div>
                    <div className="service-name">MediaMTX</div>
                    <div className={`service-status ${getStatusClass(agentStatus.mediamtx_running)}`}>
                      {agentStatus.mediamtx_running ? "RUNNING" : "STOPPED"}
                    </div>
                    <div className="service-desc">Servidor RTSP/HLS</div>
                  </div>
                  <div className="service-card">
                    <div className="service-icon">🌐</div>
                    <div className="service-name">Cloudflared</div>
                    <div className={`service-status ${getStatusClass(agentStatus.cloudflared_running)}`}>
                      {agentStatus.cloudflared_running ? "RUNNING" : "STOPPED"}
                    </div>
                    <div className="service-desc">Túnel de acceso</div>
                  </div>
                  <div className="service-card">
                    <div className="service-icon">📹</div>
                    <div className="service-name">Cámaras</div>
                    <div className="service-status status-info">
                      {agentStatus.cameras_running} / {agentStatus.cameras_total}
                    </div>
                    <div className="service-desc">Streams activos</div>
                  </div>
                </div>
              ) : (
                <p className="loading">Cargando estado...</p>
              )}
            </section>

            <section className="card">
              <h2>Información</h2>
              {agentStatus && (
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Uptime</span>
                    <span className="info-value">{formatUptime(agentStatus.uptime_secs)}</span>
                  </div>
                  {agentStatus.tunnel_url && (
                    <div className="info-item">
                      <span className="info-label">Tunnel URL</span>
                      <span className="info-value">{agentStatus.tunnel_url}</span>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Cameras Tab */}
        {activeTab === "cameras" && (
          <div className="tab-content">
            <section className="card">
              <div className="card-header">
                <h2>Cámaras Configuradas</h2>
                <button
                  className="btn btn-add"
                  onClick={() => setShowAddCamera(!showAddCamera)}
                >
                  {showAddCamera ? "✕ Cancelar" : "+ Agregar Cámara"}
                </button>
              </div>

              {/* Add Camera Form */}
              {showAddCamera && (
                <form onSubmit={handleAddCamera} className="form-add-camera">
                  <div className="form-row">
                    <div className="form-group">
                      <label>ID *</label>
                      <input
                        type="text"
                        value={newCamera.id}
                        onChange={(e) => setNewCamera({ ...newCamera, id: e.target.value })}
                        placeholder="cam1"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Nombre *</label>
                      <input
                        type="text"
                        value={newCamera.name}
                        onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                        placeholder="Cámara Principal"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>URL RTSP *</label>
                    <input
                      type="text"
                      value={newCamera.rtspUrl}
                      onChange={(e) => setNewCamera({ ...newCamera, rtspUrl: e.target.value })}
                      placeholder="rtsp://usuario:password@192.168.1.100:554/stream1"
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Encoding</label>
                      <select
                        value={newCamera.encoding}
                        onChange={(e) => setNewCamera({ ...newCamera, encoding: e.target.value as "copy" | "transcode" })}
                      >
                        <option value="copy">Copy (sin recodificar)</option>
                        <option value="transcode">Transcode (recodificar)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Calidad</label>
                      <select
                        value={newCamera.quality}
                        onChange={(e) => setNewCamera({ ...newCamera, quality: e.target.value as "low" | "medium" | "high" })}
                        disabled={newCamera.encoding === "copy"}
                      >
                        <option value="low">Baja (640x360)</option>
                        <option value="medium">Media (1280x720)</option>
                        <option value="high">Alta (1920x1080)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Audio</label>
                      <select
                        value={newCamera.audioMode}
                        onChange={(e) => setNewCamera({ ...newCamera, audioMode: e.target.value as "disabled" | "copy" | "transcode" })}
                      >
                        <option value="copy">Copiar</option>
                        <option value="transcode">Transcodificar</option>
                        <option value="disabled">Deshabilitado</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={newCamera.enabled}
                        onChange={(e) => setNewCamera({ ...newCamera, enabled: e.target.checked })}
                      />
                      Habilitada (iniciar automáticamente)
                    </label>
                  </div>
                  <button type="submit" className="btn btn-start" disabled={loading}>
                    {loading ? "Guardando..." : "💾 Guardar Cámara"}
                  </button>
                </form>
              )}

              {/* Camera List */}
              {cameras.length === 0 ? (
                <div className="empty-state">
                  <p>📷 No hay cámaras configuradas</p>
                  <p className="hint">Usa el botón "Agregar Cámara" para empezar</p>
                </div>
              ) : (
                <div className="camera-grid">
                  {cameras.map((camera) => (
                    <div key={camera.id} className={`camera-card status-${camera.status}`}>
                      <div className="camera-header">
                        <span className="camera-name">{camera.name}</span>
                        <span className={`badge badge-${camera.status}`}>
                          {camera.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="camera-body">
                        <div className="camera-info">
                          <div><strong>ID:</strong> {camera.id}</div>
                          <div><strong>URL:</strong> <code>{camera.rtspUrl}</code></div>
                          <div><strong>Encoding:</strong> {camera.encoding}</div>
                          <div><strong>Calidad:</strong> {camera.quality}</div>
                          <div><strong>Audio:</strong> {camera.audioMode}</div>
                          <div><strong>Restarts:</strong> {camera.restarts}</div>
                        </div>
                      </div>
                      <div className="camera-actions">
                        <button
                          onClick={() => handleStartCamera(camera.id)}
                          disabled={loading || camera.status === "running" || !camera.enabled}
                          className="btn btn-sm btn-start"
                          title="Iniciar"
                        >
                          ▶
                        </button>
                        <button
                          onClick={() => handleStopCamera(camera.id)}
                          disabled={loading || camera.status === "stopped"}
                          className="btn btn-sm btn-stop"
                          title="Detener"
                        >
                          ⏹
                        </button>
                        <button
                          onClick={() => handleReconnectCamera(camera.id)}
                          disabled={loading || !camera.enabled}
                          className="btn btn-sm btn-reconnect"
                          title="Reconectar"
                        >
                          🔄
                        </button>
                        <button
                          onClick={() => handleRemoveCamera(camera.id)}
                          disabled={loading}
                          className="btn btn-sm btn-danger"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="tab-content">
            <section className="card">
              <div className="card-header">
                <h2>Logs del Sistema</h2>
                <button className="btn btn-secondary" onClick={loadLogs}>
                  🔄 Actualizar
                </button>
              </div>
              <div className="logs-container">
                {logs.length === 0 ? (
                  <p className="empty-state">No hay logs disponibles</p>
                ) : (
                  <pre className="logs">
                    {logs.map((line, i) => (
                      <div key={i} className="log-line">{line}</div>
                    ))}
                  </pre>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="tab-content">
            <section className="card">
              <h2>Configuración</h2>
              <div className="settings-info">
                <h3>📁 Rutas de archivos</h3>
                <ul>
                  <li><strong>Binarios:</strong> <code>src-tauri/bin/</code></li>
                  <li><strong>Configuración:</strong> <code>%AppData%/com.streamagent.app/</code></li>
                </ul>
                
                <h3>📋 Archivos de configuración</h3>
                <ul>
                  <li><code>cameras.json</code> - Lista de cámaras</li>
                  <li><code>config.json</code> - Configuración general</li>
                  <li><code>mediamtx.yml</code> - Configuración de MediaMTX</li>
                  <li><code>cloudflared-config.yml</code> - Configuración del túnel</li>
                </ul>

                <h3>🔧 Binarios requeridos</h3>
                <ul>
                  <li><code>mediamtx.exe</code> - Servidor RTSP/HLS</li>
                  <li><code>ffmpeg.exe</code> - Procesamiento de video</li>
                  <li><code>cloudflared.exe</code> - Túnel Cloudflare (opcional)</li>
                </ul>
              </div>
            </section>

            <section className="card">
              <h2>Atajos de desarrollo</h2>
              <div className="dev-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMessage({ type: "info", text: "Función próximamente disponible" });
                  }}
                >
                  📂 Abrir carpeta de config
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMessage({ type: "info", text: "Función próximamente disponible" });
                  }}
                >
                  📝 Editar cameras.json
                </button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <span>Stream Agent v0.1.0</span>
        {loading && <span className="loading-indicator">⏳ Procesando...</span>}
      </footer>
    </div>
  );
}

export default App;
