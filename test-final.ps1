# Test final del endpoint de cambio de contraseña
$AppUrl = "http://localhost:3000/auth/change-password"
$Username = "ssorich"
$CurrentPassword = "Minoil123" # Contraseña actual
$NewPassword = "NuevaClave123" # Nueva contraseña

Write-Host "🧪 Probando endpoint de cambio de contraseña..." -ForegroundColor Cyan
Write-Host "URL: $AppUrl" -ForegroundColor Yellow
Write-Host "Usuario: $Username" -ForegroundColor Yellow

$body = @{
    username = $Username
    currentPassword = $CurrentPassword
    newPassword = $NewPassword
    confirmPassword = $NewPassword
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $AppUrl -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "✅ Respuesta exitosa:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "Código de estado: $($statusCode)" -ForegroundColor Red
        try {
            $responseStream = $_.Exception.Response.GetResponseStream()
            $streamReader = New-Object System.IO.StreamReader($responseStream)
            $responseContent = $streamReader.ReadToEnd()
            Write-Host "Cuerpo de la respuesta: $($responseContent)" -ForegroundColor Red
        } catch {
            Write-Host "No se pudo leer el cuerpo de la respuesta." -ForegroundColor DarkRed
        }
    }
}
