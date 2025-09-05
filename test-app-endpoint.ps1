# Probar el endpoint de la aplicación
$url = "http://localhost:3000/auth/change-password"
$body = @{
    username = "ssorich"
    currentPassword = "Clave123"
    newPassword = "Minoil123"
    confirmPassword = "Minoil123"
    clientIp = "192.168.1.100"
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
} | ConvertTo-Json

Write-Host "Probando endpoint de la aplicación..." -ForegroundColor Green
Write-Host "URL: $url" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "Respuesta exitosa:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "Código de estado: $statusCode" -ForegroundColor Red
    }
}
