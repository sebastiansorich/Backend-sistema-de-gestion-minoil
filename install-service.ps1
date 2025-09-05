# Script para instalar el servicio de cambio de contraseñas como servicio de Windows
# Ejecutar como administrador en el servidor AD

param(
    [string]$ServiceName = "ADPasswordService",
    [string]$ScriptPath = "C:\Scripts\ad-password-service.ps1"
)

Write-Host "🔧 Instalando servicio de cambio de contraseñas..." -ForegroundColor Cyan

# Crear script wrapper que ejecute el servicio
$wrapperScript = @"
# Wrapper para ejecutar el servicio como servicio de Windows
Set-Location "C:\Scripts"
& ".\ad-password-service.ps1"
"@

$wrapperPath = "C:\Scripts\service-wrapper.ps1"
$wrapperScript | Out-File -FilePath $wrapperPath -Encoding UTF8

# Crear servicio usando NSSM (Non-Sucking Service Manager)
# Descargar NSSM si no está instalado
$nssmPath = "C:\Scripts\nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "📥 Descargando NSSM..." -ForegroundColor Yellow
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $zipPath = "C:\Scripts\nssm.zip"
    Invoke-WebRequest -Uri $nssmUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath "C:\Scripts\" -Force
    Copy-Item "C:\Scripts\nssm-2.24\win64\nssm.exe" $nssmPath
}

# Instalar servicio
Write-Host "⚙️ Instalando servicio..." -ForegroundColor Yellow
& $nssmPath install $ServiceName "powershell.exe" "-ExecutionPolicy Bypass -File `"$wrapperPath`""

# Configurar servicio
& $nssmPath set $ServiceName DisplayName "AD Password Change Service"
& $nssmPath set $ServiceName Description "Servicio para cambio de contraseñas en Active Directory"
& $nssmPath set $ServiceName Start SERVICE_AUTO_START

# Iniciar servicio
Write-Host "🚀 Iniciando servicio..." -ForegroundColor Green
Start-Service $ServiceName

Write-Host "✅ Servicio instalado y ejecutándose!" -ForegroundColor Green
Write-Host "📋 Comandos útiles:" -ForegroundColor Cyan
Write-Host "  - Ver estado: Get-Service $ServiceName" -ForegroundColor Gray
Write-Host "  - Detener: Stop-Service $ServiceName" -ForegroundColor Gray
Write-Host "  - Iniciar: Start-Service $ServiceName" -ForegroundColor Gray
Write-Host "  - Desinstalar: & `"$nssmPath`" remove $ServiceName confirm" -ForegroundColor Gray
