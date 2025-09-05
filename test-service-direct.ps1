# Test directo del servicio web
$url = "http://SRVDC.main.minoil.com.bo:8080/api/change-password"
$body = @{
    username = "ssorich"
    currentPassword = "Minoil123"
    newPassword = "NuevaClave123"
    domain = "main.minoil.com.bo"
} | ConvertTo-Json

Write-Host "Probando servicio web directamente..." -ForegroundColor Green
Write-Host "URL: $url" -ForegroundColor Yellow
Write-Host "Body: $body" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
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
