# Instalación Rápida de Rust en Windows

## Método 1: Instalador Oficial (Recomendado)

1. Visitar: https://rustup.rs/

2. Descargar y ejecutar: `rustup-init.exe`

3. Seguir el asistente:
   - Seleccionar "1) Proceed with installation (default)"
   - Esperar a que termine (puede tardar varios minutos)

4. Reiniciar PowerShell/Terminal

5. Verificar instalación:
   ```powershell
   rustc --version
   cargo --version
   ```

## Método 2: Script PowerShell

```powershell
# Ejecutar en PowerShell como Administrador
Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
.\rustup-init.exe -y
$env:Path += ";$env:USERPROFILE\.cargo\bin"

# Verificar
rustc --version
```

## Requisitos Previos

### Visual Studio Build Tools (REQUERIDO)

Rust en Windows necesita el compilador de C++ de Microsoft:

**Opción A: Visual Studio 2022 (completo)**
- Descargar: https://visualstudio.microsoft.com/downloads/
- Instalar con "Desktop development with C++"

**Opción B: Build Tools (solo herramientas, más ligero)**
- Descargar: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
- Seleccionar: "C++ build tools"

## Verificación Post-Instalación

```powershell
# Verificar Rust
rustc --version
# Debería mostrar: rustc 1.XX.X (hash date)

# Verificar Cargo
cargo --version
# Debería mostrar: cargo 1.XX.X (hash date)

# Verificar que puede compilar
cargo new test_app
cd test_app
cargo build
```

## Troubleshooting

### Error: "linker link.exe not found"

**Causa**: Falta Visual Studio Build Tools

**Solución**: Instalar Build Tools (ver arriba) y reiniciar terminal

### Error: "rustc not found"

**Causa**: PATH no actualizado

**Solución**: 
```powershell
# Cerrar y abrir nueva ventana de PowerShell
# O agregar manualmente:
$env:Path += ";$env:USERPROFILE\.cargo\bin"
```

### Actualizar Rust

```powershell
rustup update
```

## Después de Instalar Rust

Volver a la carpeta del proyecto y ejecutar:

```powershell
cd E:\vps\camaras\camaras-lab-firstpush\padel-rstp-cam-stream\tauri
npm install
npm run tauri dev
```

## Notas

- La instalación de Rust puede tardar 5-10 minutos
- Se descargará ~300 MB de herramientas
- Visual Studio Build Tools requiere ~2-4 GB
- Después de instalar, **reiniciar el terminal es obligatorio**
