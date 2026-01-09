import React, { useState, useEffect } from "react";

export default function App() {
  const [status, setStatus] = useState("stopped");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null);
  const [tunnelUrl, setTunnelUrl] = useState(null);
  const [serverUrl, setServerUrl] = useState("http://localhost:3100");
  const [showConfig, setShowConfig] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [showCameraForm, setShowCameraForm] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [newCamera, setNewCamera] = useState({
    id: "",
    name: "",
    rtspUrl: "",
    enabled: true,
    quality: "medium",
    encoding: "copy",
  });
  const [locationId, setLocationId] = useState("default");
  const [locationName, setLocationName] = useState("Ubicación Principal");
  const [showLocationConfig, setShowLocationConfig] = useState(false);
  const [systemStats, setSystemStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [showTunnelConfig, setShowTunnelConfig] = useState(false);
  const [tunnelName, setTunnelName] = useState("");
  const [tunnelId, setTunnelId] = useState(null);
  const [tunnelConfigStep, setTunnelConfigStep] = useState("info"); // 'info', 'login', 'create', 'dns'
  const [tunnelHostname, setTunnelHostname] = useState(""); // Para configurar hostname personalizado

  // Verificar si window.api está disponible
  useEffect(() => {
    if (!window.api) {
      setError(
        "API no disponible. El preload script no se cargó correctamente."
      );
      console.error("window.api is undefined. Check preload configuration.");
    } else {
      loadCameras();
      loadLocationConfig();
      loadServerUrl();
      loadTunnelConfig();
    }
  }, []);

  // Polling para obtener URL del túnel en modo producción
  useEffect(() => {
    if (mode === "production" && status === "running") {
      const interval = setInterval(async () => {
        if (window.api) {
          const result = await window.api.getTunnelUrl();
          if (result.tunnelUrl) {
            setTunnelUrl(result.tunnelUrl);
          }

          // Verificar si hay errores
          const errorResult = await window.api.getLastError();
          if (errorResult.error) {
            setError(errorResult.error);
          }
        }
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setTunnelUrl(null);
    }
  }, [mode, status]);

  // Polling para estadísticas del sistema
  useEffect(() => {
    if (status === "running") {
      const interval = setInterval(async () => {
        if (window.api) {
          const result = await window.api.getSystemStats();
          if (result.ok) {
            setSystemStats(result.stats);
          }
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [status]);

  async function loadCameras() {
    if (!window.api) return;
    try {
      const result = await window.api.getCameras();
      if (result.ok) {
        setCameras(result.cameras);
      }
    } catch (e) {
      console.error("Error cargando cámaras:", e);
    }
  }

  async function loadLocationConfig() {
    if (!window.api) return;
    try {
      const result = await window.api.getLocationConfig();
      if (result.ok) {
        setLocationId(result.config.locationId);
        setLocationName(result.config.locationName);
      }
    } catch (e) {
      console.error("Error cargando configuración de ubicación:", e);
    }
  }

  async function loadServerUrl() {
    if (!window.api) return;
    try {
      const result = await window.api.getServerUrl();
      if (result.ok && result.serverUrl) {
        setServerUrl(result.serverUrl);
      }
    } catch (e) {
      console.error("Error cargando URL del servidor:", e);
    }
  }

  async function loadTunnelConfig() {
    if (!window.api) return;
    try {
      const result = await window.api.getTunnelConfig();
      if (result.ok && result.config) {
        setTunnelName(result.config.tunnelName || "");
        setTunnelId(result.config.tunnelId || null);
      }
    } catch (e) {
      console.error("Error cargando configuración del túnel:", e);
    }
  }

  async function handleCloudflaredLogin() {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.cloudflaredLogin();
      if (result.ok) {
        setTunnelConfigStep("create");
      } else {
        setError(result.error || "Error en login");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTunnel() {
    if (!tunnelName) {
      setError("Debes ingresar un nombre para el túnel");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Paso 1: Crear el túnel
      const result = await window.api.cloudflaredCreateTunnel(tunnelName);
      if (result.ok) {
        setTunnelId(result.id);

        // Paso 2: Si hay hostname, configurar DNS automáticamente
        if (tunnelHostname) {
          const dnsResult = await window.api.cloudflaredRouteDNS(
            tunnelName,
            tunnelHostname
          );
          if (dnsResult.ok) {
            setShowTunnelConfig(false);
            setTunnelConfigStep("info");
            await loadTunnelConfig();
            alert(
              "✅ Túnel configurado exitosamente!\n\n" +
                `Túnel: ${tunnelName}\n` +
                `URL: https://${tunnelHostname}\n\n` +
                "Reinicia los servicios en modo Producción para usar el túnel."
            );
          } else {
            // Si falla el DNS, ir al paso manual
            setTunnelConfigStep("dns");
            setError(
              "Túnel creado pero falló la configuración DNS automática. Configúralo manualmente."
            );
          }
        } else {
          // Sin hostname, ir al paso de configuración DNS opcional
          setTunnelConfigStep("dns");
          await loadTunnelConfig();
        }
      } else {
        setError(result.error || "Error creando túnel");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRouteDNS() {
    if (!tunnelHostname) {
      setError("Debes ingresar un hostname (ej: tuneluno.noaservice.org)");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await window.api.cloudflaredRouteDNS(
        tunnelName,
        tunnelHostname
      );
      if (result.ok) {
        setShowTunnelConfig(false);
        setTunnelConfigStep("info");
        await loadTunnelConfig();
        alert(
          "✅ Ruta DNS configurada exitosamente!\n\n" +
            `El túnel "${tunnelName}" ahora está accesible en:\n` +
            `https://${tunnelHostname}\n\n` +
            "Reinicia los servicios en modo Producción para aplicar los cambios."
        );
      } else {
        setError(result.error || "Error configurando ruta DNS");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveLocationConfig() {
    if (!window.api) return;
    if (!locationId || !locationName) {
      setError("ID y Nombre de ubicación son obligatorios");
      return;
    }

    setLoading(true);
    try {
      const result = await window.api.setLocationConfig({
        locationId,
        locationName,
      });
      if (result.ok) {
        setShowLocationConfig(false);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError("Error al guardar configuración de ubicación: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCamera() {
    if (!window.api) return;
    if (!newCamera.id || !newCamera.rtspUrl) {
      setError("ID y URL RTSP son obligatorios");
      return;
    }

    setLoading(true);
    try {
      const result = await window.api.addCamera(newCamera);
      if (result.ok) {
        await loadCameras();
        setNewCamera({ id: "", name: "", rtspUrl: "", enabled: true });
        setShowCameraForm(false);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError("Error al agregar cámara: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateCamera() {
    if (!window.api || !editingCamera) return;

    setLoading(true);
    try {
      const result = await window.api.updateCamera(
        editingCamera.id,
        editingCamera
      );
      if (result.ok) {
        await loadCameras();
        setEditingCamera(null);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError("Error al actualizar cámara: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCamera(id) {
    if (!window.api) return;
    if (!confirm(`¿Eliminar cámara ${id}?`)) return;

    setLoading(true);
    try {
      const result = await window.api.deleteCamera(id);
      if (result.ok) {
        await loadCameras();
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError("Error al eliminar cámara: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleCamera(id, enabled) {
    if (!window.api) return;

    setLoading(true);
    try {
      const result = await window.api.updateCamera(id, { enabled });
      if (result.ok) {
        await loadCameras();
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError("Error al actualizar cámara: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!window.api) return;

    setLoading(true);
    try {
      await window.api.setServerConfig({ serverUrl });
      setShowConfig(false);
      setError(null);
    } catch (e) {
      setError("Error al guardar configuración: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function start(selectedMode) {
    if (!window.api) {
      setError("API no disponible");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await window.api.startServices(selectedMode);
      if (result.ok) {
        setStatus("running");
        setMode(selectedMode);
      } else {
        setError(result.error || "Error desconocido");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function stop() {
    if (!window.api) {
      setError("API no disponible");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await window.api.stopServices();
      if (result.ok) {
        setStatus("stopped");
        setMode(null);
      } else {
        setError(result.error || "Error desconocido");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
      }}
    >
      {/* Header Moderno */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "20px 30px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: "700",
                letterSpacing: "-0.5px",
              }}
            >
              🎥 Stream Agent
            </h1>
            <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "5px" }}>
              Sistema de transmisión de cámaras RTSP
            </div>
          </div>
          <div
            style={{
              padding: "10px 20px",
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: "8px",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ fontSize: "11px", opacity: 0.8 }}>📍 Ubicación</div>
            <div
              style={{ fontSize: "14px", fontWeight: "600", marginTop: "2px" }}
            >
              {locationName}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{ padding: "25px 30px", maxWidth: "1200px", margin: "0 auto" }}
      >
        {/* Estado del Sistema - Card Destacado */}
        <div
          style={{
            padding: "20px",
            marginBottom: "25px",
            borderRadius: "12px",
            backgroundColor: "white",
            boxShadow: "0 4px 6px rgba(0,0,0,0.07)",
            border: `3px solid ${status === "running" ? "#10b981" : "#ef4444"}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  backgroundColor: status === "running" ? "#d1fae5" : "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                {status === "running" ? "✅" : "⏸️"}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#1f2937",
                    marginBottom: "3px",
                  }}
                >
                  {status === "running" ? "Sistema Activo" : "Sistema Detenido"}
                </div>
                {mode && (
                  <div style={{ fontSize: "14px", color: "#6b7280" }}>
                    {mode === "test"
                      ? "🧪 Modo Prueba - Solo local"
                      : "🌐 Modo Producción - Transmitiendo"}
                  </div>
                )}
              </div>
            </div>
            {status === "running" && (
              <button
                onClick={() => setShowStats(!showStats)}
                style={{
                  padding: "10px 20px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  backgroundColor: showStats ? "#667eea" : "#f3f4f6",
                  color: showStats ? "white" : "#4b5563",
                  border: "none",
                  borderRadius: "8px",
                  transition: "all 0.2s",
                  boxShadow: showStats
                    ? "0 2px 4px rgba(102,126,234,0.3)"
                    : "none",
                }}
              >
                📊 {showStats ? "Ocultar" : "Ver"} Estadísticas
              </button>
            )}
          </div>
        </div>

        {/* Estadísticas del Sistema */}
        {showStats && systemStats && (
          <div
            style={{
              padding: "20px",
              marginBottom: "25px",
              borderRadius: "12px",
              backgroundColor: "white",
              boxShadow: "0 4px 6px rgba(0,0,0,0.07)",
            }}
          >
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: "16px",
                fontWeight: "700",
                color: "#1f2937",
              }}
            >
              📊 Monitoreo del Sistema
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "15px",
              }}
            >
              {/* CPU */}
              <div
                style={{
                  padding: "15px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                  }}
                >
                  🖥️ CPU
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: "700",
                    color: systemStats.cpu.usage > 80 ? "#ef4444" : "#10b981",
                    marginBottom: "5px",
                  }}
                >
                  {systemStats.cpu.usage}%
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                  {systemStats.cpu.cores} núcleos disponibles
                </div>
              </div>

              {/* RAM */}
              <div
                style={{
                  padding: "15px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                  }}
                >
                  💾 Memoria RAM
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: "700",
                    color:
                      systemStats.memory.usagePercent > 85
                        ? "#ef4444"
                        : "#3b82f6",
                    marginBottom: "5px",
                  }}
                >
                  {systemStats.memory.usagePercent}%
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                  {systemStats.memory.used} MB / {systemStats.memory.total} MB
                </div>
                <div
                  style={{
                    marginTop: "5px",
                    height: "6px",
                    backgroundColor: "#e0e0e0",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${systemStats.memory.usagePercent}%`,
                      height: "100%",
                      backgroundColor:
                        systemStats.memory.usagePercent > 85
                          ? "#dc3545"
                          : "#007bff",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>

              {/* Procesos */}
              <div
                style={{
                  padding: "15px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                  }}
                >
                  ⚙️ Procesos
                </div>
                <div style={{ fontSize: "13px", marginTop: "10px" }}>
                  <div style={{ marginBottom: "6px" }}>
                    {systemStats.processes.mediamtx ? "🟢" : "🔴"} MediaMTX
                  </div>
                  <div style={{ marginBottom: "6px" }}>
                    {systemStats.processes.ffmpegCount > 0 ? "🟢" : "🔴"} FFmpeg
                    ({systemStats.processes.ffmpegCount})
                  </div>
                  <div>
                    {systemStats.processes.cloudflared ? "🟢" : "🔴"}{" "}
                    Cloudflared
                  </div>
                </div>
              </div>

              {/* Cámaras */}
              <div
                style={{
                  padding: "15px",
                  backgroundColor: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    marginBottom: "8px",
                    fontWeight: "600",
                  }}
                >
                  📹 Cámaras
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: "700",
                    color: "#8b5cf6",
                    marginBottom: "5px",
                  }}
                >
                  {systemStats.cameras.enabled}/{systemStats.cameras.total}
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                  activas / totales
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: "15px",
                padding: "10px",
                backgroundColor: "#fef3c7",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#92400e",
                textAlign: "center",
              }}
            >
              ⏱️ Tiempo activo: {Math.floor(systemStats.uptime / 60)} minutos
            </div>
          </div>
        )}

        {/* URL Pública */}
        {tunnelUrl && mode === "production" && (
          <div
            style={{
              padding: "20px",
              marginBottom: "25px",
              borderRadius: "12px",
              backgroundColor: "#ecfdf5",
              border: "2px solid #10b981",
              boxShadow: "0 4px 6px rgba(16,185,129,0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                gap: "15px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "#065f46",
                    marginBottom: "8px",
                  }}
                >
                  🌐 URL Pública Activa
                </div>
                <div
                  style={{
                    fontSize: "15px",
                    wordBreak: "break-all",
                    marginBottom: "8px",
                  }}
                >
                  <a
                    href={tunnelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#059669",
                      textDecoration: "none",
                      fontWeight: "600",
                    }}
                  >
                    {tunnelUrl}
                  </a>
                </div>
                {tunnelName && (
                  <div style={{ fontSize: "12px", color: "#047857" }}>
                    Túnel: <strong>{tunnelName}</strong>{" "}
                    {tunnelId && `(${tunnelId.substring(0, 8)}...)`}
                  </div>
                )}
              </div>
              <div
                style={{ display: "flex", gap: "8px", flexDirection: "column" }}
              >
                <button
                  onClick={async () => {
                    if (!window.api) return;
                    setLoading(true);
                    try {
                      const result = await window.api.flushDNSCache();
                      if (result.success) {
                        alert("✅ Caché DNS limpiada");
                      } else {
                        alert("❌ Error: " + result.error);
                      }
                    } catch (err) {
                      alert("❌ Error: " + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  style={{
                    padding: "8px 15px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: loading ? "not-allowed" : "pointer",
                    backgroundColor: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {loading ? "⏳" : "🔄"} Limpiar DNS
                </button>
                <button
                  onClick={() => {
                    setShowTunnelConfig(true);
                    setTunnelConfigStep("dns");
                  }}
                  disabled={loading || !tunnelName}
                  style={{
                    padding: "8px 15px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: loading || !tunnelName ? "not-allowed" : "pointer",
                    opacity: loading || !tunnelName ? 0.6 : 1,
                    backgroundColor: "#6b7280",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⚙️ Config DNS
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div
            style={{
              padding: "15px 20px",
              marginBottom: "25px",
              borderRadius: "12px",
              backgroundColor: "#fef2f2",
              border: "2px solid #fca5a5",
              color: "#991b1b",
            }}
          >
            <div style={{ fontWeight: "700", marginBottom: "5px" }}>
              ⚠️ Error
            </div>
            <div style={{ fontSize: "13px" }}>{error}</div>
            {error.includes("ENOTFOUND") && error.includes("cloudflare") && (
              <button
                onClick={async () => {
                  if (!window.api) return;
                  setLoading(true);
                  try {
                    const result = await window.api.changeDNSToCloudflare();
                    if (result.success) {
                      alert("✅ DNS cambiado a Cloudflare");
                      setError(null);
                    } else {
                      alert("❌ Error: " + result.error);
                    }
                  } catch (err) {
                    alert("❌ Error: " + err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                style={{
                  marginTop: "10px",
                  padding: "8px 15px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer",
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                }}
              >
                {loading ? "⏳ Cambiando..." : "🔧 Cambiar DNS a Cloudflare"}
              </button>
            )}
          </div>
        )}

        <div
          style={{
            marginBottom: "15px",
            padding: "10px",
            backgroundColor: "#e7f3ff",
            borderRadius: "5px",
            border: "1px solid #b3d9ff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong style={{ fontSize: "14px" }}>📍 Ubicación:</strong>
              <div
                style={{ fontSize: "12px", color: "#666", marginTop: "3px" }}
              >
                {locationName}{" "}
                <span style={{ color: "#999" }}>({locationId})</span>
              </div>
            </div>
            <button
              onClick={() => setShowLocationConfig(!showLocationConfig)}
              disabled={status === "running"}
              style={{
                padding: "5px 15px",
                fontSize: "11px",
                cursor: status === "running" ? "not-allowed" : "pointer",
                opacity: status === "running" ? 0.6 : 1,
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              ✏️ Editar
            </button>
          </div>
        </div>

        {showLocationConfig && (
          <div
            style={{
              padding: "15px",
              marginBottom: "20px",
              borderRadius: "5px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffeaa7",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
              ⚙️ Configuración de Ubicación
            </h4>
            <p
              style={{
                fontSize: "11px",
                color: "#856404",
                marginBottom: "10px",
              }}
            >
              Configura un identificador único para esta máquina. Esto permite
              diferenciar cámaras de diferentes ubicaciones.
            </p>
            <div style={{ marginBottom: "10px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                ID de Ubicación (único, sin espacios):
              </label>
              <input
                type="text"
                value={locationId}
                onChange={(e) =>
                  setLocationId(
                    e.target.value.toLowerCase().replace(/\s+/g, "-")
                  )
                }
                placeholder="sede-norte, club-1, campo-principal"
                style={{
                  width: "100%",
                  padding: "8px",
                  fontSize: "12px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                Nombre de Ubicación:
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Club Principal - Buenos Aires"
                style={{
                  width: "100%",
                  padding: "8px",
                  fontSize: "12px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={saveLocationConfig}
                disabled={loading}
                style={{
                  padding: "8px 15px",
                  fontSize: "12px",
                  cursor: loading ? "not-allowed" : "pointer",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                💾 Guardar
              </button>
              <button
                onClick={() => setShowLocationConfig(false)}
                style={{
                  padding: "8px 15px",
                  fontSize: "12px",
                  cursor: "pointer",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ fontSize: "16px", margin: 0 }}>Seleccionar modo:</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setShowTunnelConfig(!showTunnelConfig)}
              disabled={status === "running"}
              style={{
                padding: "5px 15px",
                fontSize: "12px",
                cursor: status === "running" ? "not-allowed" : "pointer",
                opacity: status === "running" ? 0.6 : 1,
                backgroundColor: tunnelId ? "#17a2b8" : "#ffc107",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              {tunnelId ? "🔐 Túnel Configurado" : "🔓 Configurar Túnel"}
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              disabled={status === "running"}
              style={{
                padding: "5px 15px",
                fontSize: "12px",
                cursor: status === "running" ? "not-allowed" : "pointer",
                opacity: status === "running" ? 0.6 : 1,
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              ⚙️ Configurar Servidor
            </button>
          </div>
        </div>

        {showTunnelConfig && (
          <div
            style={{
              padding: "15px",
              marginBottom: "20px",
              borderRadius: "5px",
              backgroundColor: "#e7f3ff",
              border: "1px solid #b3d9ff",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
              🔐 Configurar Túnel con Cuenta Cloudflare
            </h4>

            {tunnelId ? (
              <div>
                <div
                  style={{
                    padding: "10px",
                    backgroundColor: "#d4edda",
                    borderRadius: "4px",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#155724" }}>
                    ✅ <strong>Túnel configurado:</strong> {tunnelName}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#155724",
                      marginTop: "5px",
                    }}
                  >
                    ID: {tunnelId}
                  </div>
                </div>
                <p
                  style={{
                    fontSize: "11px",
                    color: "#004085",
                    margin: "10px 0",
                  }}
                >
                  Este túnel es permanente y más estable que los quick tunnels.
                  Se iniciará automáticamente en modo producción.
                </p>
                <button
                  onClick={() => {
                    setTunnelConfigStep("create");
                    setTunnelName("");
                    setTunnelId(null);
                  }}
                  style={{
                    padding: "6px 12px",
                    fontSize: "11px",
                    cursor: "pointer",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  🔄 Cambiar Túnel
                </button>
              </div>
            ) : (
              <div>
                {tunnelConfigStep === "info" && (
                  <div>
                    <p style={{ fontSize: "12px", marginBottom: "10px" }}>
                      Los túneles con cuenta son{" "}
                      <strong>más estables y permanentes</strong> que los quick
                      tunnels.
                    </p>
                    <div
                      style={{
                        padding: "10px",
                        backgroundColor: "#fff3cd",
                        borderRadius: "4px",
                        marginBottom: "10px",
                        fontSize: "11px",
                      }}
                    >
                      <strong>Ventajas:</strong>
                      <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                        <li>URL permanente (no cambia al reiniciar)</li>
                        <li>Mayor estabilidad y uptime</li>
                        <li>No requiere conexión DNS perfecta</li>
                        <li>Recomendado para producción</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => setTunnelConfigStep("login")}
                      disabled={loading}
                      style={{
                        padding: "8px 15px",
                        fontSize: "12px",
                        cursor: loading ? "not-allowed" : "pointer",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                      }}
                    >
                      ▶️ Comenzar Configuración
                    </button>
                  </div>
                )}

                {tunnelConfigStep === "login" && (
                  <div>
                    <p style={{ fontSize: "12px", marginBottom: "10px" }}>
                      <strong>Paso 1:</strong> Inicia sesión en Cloudflare
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        marginBottom: "10px",
                      }}
                    >
                      Se abrirá tu navegador para que inicies sesión con tu
                      cuenta de Cloudflare (gratuita). Si no tienes cuenta,
                      puedes crear una en ese momento.
                    </p>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={handleCloudflaredLogin}
                        disabled={loading}
                        style={{
                          padding: "8px 15px",
                          fontSize: "12px",
                          cursor: loading ? "not-allowed" : "pointer",
                          backgroundColor: "#28a745",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                        }}
                      >
                        {loading
                          ? "⏳ Abriendo navegador..."
                          : "🔑 Iniciar Sesión"}
                      </button>
                      <button
                        onClick={() => setTunnelConfigStep("info")}
                        style={{
                          padding: "8px 15px",
                          fontSize: "12px",
                          cursor: "pointer",
                          backgroundColor: "#6c757d",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                        }}
                      >
                        ← Atrás
                      </button>
                    </div>
                  </div>
                )}

                {tunnelConfigStep === "create" && (
                  <div>
                    <p style={{ fontSize: "12px", marginBottom: "10px" }}>
                      <strong>Paso 2:</strong> Crea tu túnel y configura DNS
                    </p>
                    <div style={{ marginBottom: "10px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "5px",
                          fontSize: "12px",
                        }}
                      >
                        Nombre del túnel (sin espacios):
                      </label>
                      <input
                        type="text"
                        value={tunnelName}
                        onChange={(e) =>
                          setTunnelName(
                            e.target.value.toLowerCase().replace(/\s+/g, "-")
                          )
                        }
                        placeholder="mi-stream-padel"
                        style={{
                          width: "100%",
                          padding: "8px",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: "10px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "5px",
                          fontSize: "12px",
                        }}
                      >
                        Hostname personalizado (opcional):
                      </label>
                      <input
                        type="text"
                        value={tunnelHostname}
                        onChange={(e) =>
                          setTunnelHostname(e.target.value.toLowerCase())
                        }
                        placeholder="tuneluno.noaservice.org"
                        style={{
                          width: "100%",
                          padding: "8px",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#666",
                          marginTop: "5px",
                        }}
                      >
                        Si lo dejas vacío, se usará el ID del túnel. Con
                        hostname personalizado tu stream será más accesible.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={handleCreateTunnel}
                        disabled={loading || !tunnelName}
                        style={{
                          padding: "8px 15px",
                          fontSize: "12px",
                          cursor:
                            loading || !tunnelName ? "not-allowed" : "pointer",
                          opacity: loading || !tunnelName ? 0.6 : 1,
                          backgroundColor: "#28a745",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                        }}
                      >
                        {loading ? "⏳ Creando..." : "✅ Crear Túnel"}
                      </button>
                      <button
                        onClick={() => setTunnelConfigStep("login")}
                        style={{
                          padding: "8px 15px",
                          fontSize: "12px",
                          cursor: "pointer",
                          backgroundColor: "#6c757d",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                        }}
                      >
                        ← Atrás
                      </button>
                    </div>
                  </div>
                )}

                {tunnelConfigStep === "dns" && (
                  <div>
                    <p style={{ fontSize: "12px", marginBottom: "10px" }}>
                      <strong>Paso 3:</strong> Configura tu dominio
                      personalizado
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        marginBottom: "10px",
                      }}
                    >
                      El túnel <strong>{tunnelName}</strong> fue creado
                      exitosamente. Ahora configura un hostname personalizado
                      para mejor accesibilidad.
                    </p>
                    <div style={{ marginBottom: "10px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "5px",
                          fontSize: "12px",
                        }}
                      >
                        Hostname (subdominio.tudominio.com):
                      </label>
                      <input
                        type="text"
                        value={tunnelHostname}
                        onChange={(e) =>
                          setTunnelHostname(e.target.value.toLowerCase())
                        }
                        placeholder="tuneluno.noaservice.org"
                        style={{
                          width: "100%",
                          padding: "8px",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#666",
                          marginTop: "5px",
                        }}
                      >
                        Ejemplo: stream.midominio.com o cam1.midominio.com
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={handleRouteDNS}
                        disabled={loading || !tunnelHostname}
                        style={{
                          padding: "8px 15px",
                          fontSize: "12px",
                          cursor:
                            loading || !tunnelHostname
                              ? "not-allowed"
                              : "pointer",
                          opacity: loading || !tunnelHostname ? 0.6 : 1,
                          backgroundColor: "#007bff",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                        }}
                      >
                        {loading ? "⏳ Configurando..." : "🌐 Configurar DNS"}
                      </button>
                      <button
                        onClick={() => {
                          setShowTunnelConfig(false);
                          setTunnelConfigStep("info");
                        }}
                        style={{
                          padding: "8px 15px",
                          fontSize: "12px",
                          cursor: "pointer",
                          backgroundColor: "#6c757d",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                        }}
                      >
                        Omitir (usar ID por defecto)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: "16px", margin: 0 }}>Seleccionar modo:</h3>
          <button
            onClick={() => setShowConfig(!showConfig)}
            disabled={status === "running"}
            style={{
              padding: "5px 15px",
              fontSize: "12px",
              cursor: status === "running" ? "not-allowed" : "pointer",
              opacity: status === "running" ? 0.6 : 1,
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            ⚙️ Configurar Servidor
          </button>
        </div>

        {showConfig && (
          <div
            style={{
              padding: "15px",
              marginBottom: "20px",
              borderRadius: "5px",
              backgroundColor: "#f8f9fa",
              border: "1px solid #dee2e6",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
              Configuración del Servidor
            </h4>
            <div style={{ marginBottom: "10px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "12px",
                }}
              >
                URL del Servidor:
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://tu-servidor.com:3100"
                style={{
                  width: "100%",
                  padding: "8px",
                  fontSize: "12px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={saveConfig}
              disabled={loading}
              style={{
                padding: "8px 15px",
                fontSize: "12px",
                cursor: loading ? "not-allowed" : "pointer",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              💾 Guardar Configuración
            </button>
          </div>
        )}

        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <h3 style={{ fontSize: "16px", margin: 0 }}>
              📹 Cámaras ({cameras.length})
            </h3>
            <button
              onClick={() => setShowCameraForm(!showCameraForm)}
              disabled={status === "running"}
              style={{
                padding: "5px 15px",
                fontSize: "12px",
                cursor: status === "running" ? "not-allowed" : "pointer",
                opacity: status === "running" ? 0.6 : 1,
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
                borderRadius: "4px",
              }}
            >
              ➕ Agregar Cámara
            </button>
          </div>

          {showCameraForm && (
            <div
              style={{
                padding: "15px",
                marginBottom: "15px",
                borderRadius: "5px",
                backgroundColor: "#f8f9fa",
                border: "1px solid #dee2e6",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
                Nueva Cámara
              </h4>
              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "12px",
                  }}
                >
                  ID (único):
                </label>
                <input
                  type="text"
                  value={newCamera.id}
                  onChange={(e) =>
                    setNewCamera({ ...newCamera, id: e.target.value })
                  }
                  placeholder="cam2"
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "12px",
                  }}
                >
                  Nombre:
                </label>
                <input
                  type="text"
                  value={newCamera.name}
                  onChange={(e) =>
                    setNewCamera({ ...newCamera, name: e.target.value })
                  }
                  placeholder="Cámara Secundaria"
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "12px",
                  }}
                >
                  URL RTSP:
                </label>
                <input
                  type="text"
                  value={newCamera.rtspUrl}
                  onChange={(e) =>
                    setNewCamera({ ...newCamera, rtspUrl: e.target.value })
                  }
                  placeholder="rtsp://user:pass@192.168.1.240:1945"
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  Modo de Codificación:
                </label>
                <select
                  value={newCamera.encoding || "copy"}
                  onChange={(e) =>
                    setNewCamera({ ...newCamera, encoding: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "12px",
                    boxSizing: "border-box",
                    marginBottom: "5px",
                  }}
                >
                  <option value="copy">
                    🚀 Copiar Directo (bajo CPU, calidad original)
                  </option>
                  <option value="transcode">
                    🎯 Recodificar (alto CPU, menor ancho de banda)
                  </option>
                </select>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#666",
                    marginTop: "3px",
                    padding: "5px",
                    backgroundColor: "#f0f0f0",
                    borderRadius: "3px",
                  }}
                >
                  {newCamera.encoding === "copy"
                    ? "✅ Modo recomendado: Copia el stream sin modificarlo. Bajo uso de CPU, mantiene resolución original de la cámara."
                    : "⚠️ Recodifica el video para reducir resolución y ancho de banda. Mayor uso de CPU."}
                </div>
              </div>
              {newCamera.encoding === "transcode" && (
                <div style={{ marginBottom: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontSize: "12px",
                    }}
                  >
                    Calidad (solo para recodificación):
                  </label>
                  <select
                    value={newCamera.quality || "medium"}
                    onChange={(e) =>
                      setNewCamera({ ...newCamera, quality: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "12px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="low">
                      📉 Baja (360p @ 800 kbps) - Menor consumo
                    </option>
                    <option value="medium">
                      📊 Media (720p @ 2 Mbps) - Recomendado
                    </option>
                    <option value="high">
                      📈 Alta (1080p @ 4 Mbps) - Mejor calidad
                    </option>
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={handleAddCamera}
                  disabled={loading}
                  style={{
                    padding: "8px 15px",
                    fontSize: "12px",
                    cursor: loading ? "not-allowed" : "pointer",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  ✅ Agregar
                </button>
                <button
                  onClick={() => {
                    setShowCameraForm(false);
                    setNewCamera({
                      id: "",
                      name: "",
                      rtspUrl: "",
                      enabled: true,
                    });
                  }}
                  style={{
                    padding: "8px 15px",
                    fontSize: "12px",
                    cursor: "pointer",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          )}

          {editingCamera && (
            <div
              style={{
                padding: "15px",
                marginBottom: "15px",
                borderRadius: "5px",
                backgroundColor: "#fff3cd",
                border: "1px solid #ffeaa7",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
                Editar Cámara: {editingCamera.id}
              </h4>
              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "12px",
                  }}
                >
                  Nombre:
                </label>
                <input
                  type="text"
                  value={editingCamera.name}
                  onChange={(e) =>
                    setEditingCamera({ ...editingCamera, name: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "12px",
                  }}
                >
                  URL RTSP:
                </label>
                <input
                  type="text"
                  value={editingCamera.rtspUrl}
                  onChange={(e) =>
                    setEditingCamera({
                      ...editingCamera,
                      rtspUrl: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontSize: "12px",
                  }}
                >
                  Modo:
                </label>
                <select
                  value={editingCamera.encoding || "copy"}
                  onChange={(e) =>
                    setEditingCamera({
                      ...editingCamera,
                      encoding: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    fontSize: "12px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="copy">🚀 Copiar</option>
                  <option value="transcode">🎯 Recodificar</option>
                </select>
              </div>
              {editingCamera.encoding === "transcode" && (
                <div style={{ marginBottom: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontSize: "12px",
                    }}
                  >
                    Calidad:
                  </label>
                  <select
                    value={editingCamera.quality || "medium"}
                    onChange={(e) =>
                      setEditingCamera({
                        ...editingCamera,
                        quality: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontSize: "12px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="low">📉 Baja (360p)</option>
                    <option value="medium">📊 Media (720p)</option>
                    <option value="high">📈 Alta (1080p)</option>
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={handleUpdateCamera}
                  disabled={loading}
                  style={{
                    padding: "8px 15px",
                    fontSize: "12px",
                    cursor: loading ? "not-allowed" : "pointer",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  💾 Guardar
                </button>
                <button
                  onClick={() => setEditingCamera(null)}
                  style={{
                    padding: "8px 15px",
                    fontSize: "12px",
                    cursor: "pointer",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              marginBottom: "20px",
              border: "1px solid #dee2e6",
              borderRadius: "5px",
            }}
          >
            {cameras.length === 0 ? (
              <div
                style={{ padding: "20px", textAlign: "center", color: "#999" }}
              >
                No hay cámaras configuradas
              </div>
            ) : (
              cameras.map((camera) => (
                <div
                  key={camera.id}
                  style={{
                    padding: "15px",
                    borderBottom: "1px solid #dee2e6",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: camera.enabled ? "white" : "#f8f9fa",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        marginBottom: "5px",
                      }}
                    >
                      {camera.enabled ? "🟢" : "🔴"} {camera.name}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        marginBottom: "3px",
                      }}
                    >
                      ID: <code>{camera.id}</code>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        marginBottom: "3px",
                      }}
                    >
                      Modo:{" "}
                      {camera.encoding === "copy"
                        ? "🚀 Copiar"
                        : "🎯 Recodificar"}
                      {camera.encoding === "transcode" &&
                        ` (${camera.quality === "low" ? "📉 Baja" : camera.quality === "high" ? "📈 Alta" : "📊 Media"})`}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        wordBreak: "break-all",
                      }}
                    >
                      RTSP: {camera.rtspUrl}
                    </div>
                    {tunnelUrl && mode === "production" && camera.enabled && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#0c5460",
                          marginTop: "5px",
                        }}
                      >
                        🌐 Público:{" "}
                        <a
                          href={`${tunnelUrl}/${camera.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {tunnelUrl}/{camera.id}
                        </a>
                      </div>
                    )}
                  </div>
                  <div
                    style={{ display: "flex", gap: "5px", marginLeft: "10px" }}
                  >
                    <button
                      onClick={() =>
                        handleToggleCamera(camera.id, !camera.enabled)
                      }
                      disabled={loading || status === "running"}
                      title={camera.enabled ? "Deshabilitar" : "Habilitar"}
                      style={{
                        padding: "5px 10px",
                        fontSize: "12px",
                        cursor:
                          loading || status === "running"
                            ? "not-allowed"
                            : "pointer",
                        opacity: loading || status === "running" ? 0.6 : 1,
                        backgroundColor: camera.enabled ? "#ffc107" : "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                      }}
                    >
                      {camera.enabled ? "⏸️" : "▶️"}
                    </button>
                    <button
                      onClick={() => setEditingCamera(camera)}
                      disabled={loading || status === "running"}
                      title="Editar"
                      style={{
                        padding: "5px 10px",
                        fontSize: "12px",
                        cursor:
                          loading || status === "running"
                            ? "not-allowed"
                            : "pointer",
                        opacity: loading || status === "running" ? 0.6 : 1,
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteCamera(camera.id)}
                      disabled={loading || status === "running"}
                      title="Eliminar"
                      style={{
                        padding: "5px 10px",
                        fontSize: "12px",
                        cursor:
                          loading || status === "running"
                            ? "not-allowed"
                            : "pointer",
                        opacity: loading || status === "running" ? 0.6 : 1,
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>
            Control de servicios:
          </h3>
          <button
            onClick={() => start("test")}
            disabled={loading || status === "running"}
            style={{
              padding: "10px 20px",
              marginRight: "10px",
              fontSize: "14px",
              cursor:
                loading || status === "running" ? "not-allowed" : "pointer",
              opacity: loading || status === "running" ? 0.6 : 1,
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            {loading ? "⏳ Cargando..." : "🧪 Modo Prueba"}
          </button>

          <button
            onClick={() => start("production")}
            disabled={loading || status === "running"}
            style={{
              padding: "10px 20px",
              marginRight: "10px",
              fontSize: "14px",
              cursor:
                loading || status === "running" ? "not-allowed" : "pointer",
              opacity: loading || status === "running" ? 0.6 : 1,
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            {loading ? "⏳ Cargando..." : "🌐 Modo Producción"}
          </button>

          <button
            onClick={stop}
            disabled={loading || status === "stopped"}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              cursor:
                loading || status === "stopped" ? "not-allowed" : "pointer",
              opacity: loading || status === "stopped" ? 0.6 : 1,
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            {loading ? "⏳ Cargando..." : "⏹️ Detener servicios"}
          </button>
        </div>

        <div style={{ marginTop: "30px", fontSize: "12px", color: "#666" }}>
          <p>
            <strong>Servicios gestionados:</strong>
          </p>
          <ul>
            <li>
              <strong>MediaMTX</strong> - Servidor de streaming RTSP/HLS
            </li>
            <li>
              <strong>FFmpeg</strong> - Captura y recodificación de video
            </li>
            <li>
              <strong>Cloudflared</strong> - Túnel público seguro (solo en modo
              producción)
            </li>
          </ul>
          <div
            style={{
              marginTop: "15px",
              padding: "10px",
              backgroundColor: "#e7f3ff",
              borderRadius: "4px",
            }}
          >
            <p style={{ margin: "0 0 5px 0" }}>
              <strong>💡 Modos:</strong>
            </p>
            <p style={{ margin: "5px 0" }}>
              <strong>🧪 Prueba:</strong> Solo MediaMTX + FFmpeg (para
              desarrollo local)
            </p>
            <p style={{ margin: "5px 0" }}>
              <strong>🌐 Producción:</strong> Todos los servicios + túnel
              público
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
