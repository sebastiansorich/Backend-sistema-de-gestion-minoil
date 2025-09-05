# Script de prueba para el servicio de cambio de contraseñas
# Ejecutar desde tu máquina local

param(
    [string]$ServerUrl = "http://SRVDC.main.minoil.com.bo:8080/api/change-password",
    [string]$Username = "ssorich",
    [string]$CurrentPassword = "Clave123",
    [string]$NewPassword = "Minoil123"
)

Write-Host "🧪 Probando servicio de cambio de contraseñas..." -ForegroundColor Cyan
Write-Host "URL: $ServerUrl" -ForegroundColor Yellow
Write-Host "Usuario: $Username" -ForegroundColor Yellow

# Preparar datos
$body = @{
    username = $Username
    currentPassword = $CurrentPassword
    newPassword = $NewPassword
    domain = "main.minoil.com.bo"
} | ConvertTo-Json

Write-Host "📤 Enviando petición..." -ForegroundColor Green

try {
    # Enviar petición
    $response = Invoke-RestMethod -Uri $ServerUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    
    Write-Host "✅ Respuesta del servidor:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
    
    if ($response.success) {
        Write-Host "🎉 ¡Cambio de contraseña exitoso!" -ForegroundColor Green
    } else {
        Write-Host "❌ Error en el cambio de contraseña" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Error en la petición:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "Código de estado: $statusCode" -ForegroundColor Red
    }
}

Write-Host "`n🔍 Para probar manualmente con curl:" -ForegroundColor Cyan
Write-Host "curl -X POST '$ServerUrl' -H 'Content-Type: application/json' -d '$body'" -ForegroundColor Gray
