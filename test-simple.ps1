# Script simple de prueba
$url = "http://SRVDC.main.minoil.com.bo:8080/api/change-password"
$body = @{
    username = "ssorich"
    currentPassword = "Clave123"
    newPassword = "Minoil123"
    domain = "main.minoil.com.bo"
} | ConvertTo-Json

Write-Host "Probando servicio..." -ForegroundColor Green
Write-Host "URL: $url" -ForegroundColor Yellow
Write-Host "Body: $body" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "Respuesta exitosa:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
