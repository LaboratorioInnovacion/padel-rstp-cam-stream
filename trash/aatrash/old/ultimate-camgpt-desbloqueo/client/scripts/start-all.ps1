# PowerShell para lanzar mediamtx, frpc y ffmpeg
# Carga lista de cámaras
$cams = Get-Content ../config/cameras.json | ConvertFrom-Json

# 1. Inicia MediaMTX
Start-Process -NoNewWindow -FilePath "../mediamtx/mediamtx.exe" -ArgumentList "-c ../client/config/mediamtx.yml"
Start-Sleep 2

# 2. Genera frpc.toml dinámico
$frpcTemplate = Get-Content ../config/frpc-template.toml
$camsList = $cams.GetEnumerator() | ForEach-Object {
  @"
[[proxies]]
name = "rtsp_${($_.Key)}"
type = "tcp"
local_ip = "127.0.0.1"
local_port = 8554
remote_port = ${($_.Value.remotePort)}
"@
} -join "`n"
$frpcConfig = $frpcTemplate -replace "__CAMERAS__", $camsList
$frpcConfig | Set-Content ../client/frpc/frpc.toml

# 3. Inicia frpc
Start-Process -NoNewWindow -FilePath "../client/frpc/frpc.exe" -ArgumentList "-c ../client/frpc/frpc.toml"
Start-Sleep 5

# 4. Inicia FFmpeg para cada cámara
foreach ($cam in $cams.GetEnumerator()) {
  $id = $cam.Key
  $url = $cam.Value.localUrl
  Start-Process -NoNewWindow -FilePath "../client/ffmpeg/ffmpeg.exe" -ArgumentList 
    @('-rtsp_transport','tcp','-i',$url,'-c','copy','-f','rtsp',"rtsp://127.0.0.1:8554/$id")
  Write-Host "Stream iniciado: $id -> rtsp://127.0.0.1:8554/$id"
}