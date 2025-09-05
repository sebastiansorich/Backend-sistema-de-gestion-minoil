# Servicio Web para Cambio de Contraseñas en Active Directory
# Ejecutar en el servidor SRVDC.main.minoil.com.bo

param(
    [string]$Username,
    [string]$CurrentPassword,
    [string]$NewPassword,
    [string]$Domain = "main.minoil.com.bo"
)

# Función para cambiar contraseña usando PowerShell AD
function Change-ADPassword {
    param(
        [string]$User,
        [string]$CurrentPwd,
        [string]$NewPwd,
        [string]$DomainName
    )
    
    try {
        # Importar módulo Active Directory
        Import-Module ActiveDirectory -ErrorAction Stop
        
        # Crear credenciales del administrador (ssorich)
        $adminUsername = "ssorich"
        $adminPassword = "Minoil123"
        $secureAdminPassword = ConvertTo-SecureString $adminPassword -AsPlainText -Force
        $adminCredential = New-Object System.Management.Automation.PSCredential("$adminUsername@$DomainName", $secureAdminPassword)
        
        # Cambiar contraseña usando Set-ADAccountPassword con -Reset (bypasea políticas)
        $secureNewPassword = ConvertTo-SecureString $NewPwd -AsPlainText -Force
        Set-ADAccountPassword -Identity $User -NewPassword $secureNewPassword -Reset -Credential $adminCredential
        
        Write-Output "SUCCESS: Contraseña cambiada exitosamente para $User"
        return $true
    }
    catch {
        Write-Error "ERROR: $($_.Exception.Message)"
        return $false
    }
}

# Función para crear servidor web simple
function Start-PasswordWebService {
    param([int]$Port = 8080)
    
    # Crear listener HTTP
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://+:$Port/")
    $listener.Start()
    
    Write-Host "Servicio de cambio de contraseñas iniciado en puerto $Port"
    Write-Host "URL: http://localhost:$Port/api/change-password"
    
    while ($listener.IsListening) {
        try {
            # Esperar petición
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response
            
            # Configurar CORS
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
            
            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }
            
            if ($request.Url.AbsolutePath -eq "/api/change-password" -and $request.HttpMethod -eq "POST") {
                # Leer datos del request
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $jsonData = $reader.ReadToEnd()
                $data = $jsonData | ConvertFrom-Json
                
                # Cambiar contraseña
                $result = Change-ADPassword -User $data.username -CurrentPwd $data.currentPassword -NewPwd $data.newPassword -DomainName $data.domain
                
                # Preparar respuesta
                $response.ContentType = "application/json"
                $response.StatusCode = if ($result) { 200 } else { 400 }
                
                $responseData = @{
                    success = $result
                    message = if ($result) { "Contraseña cambiada exitosamente" } else { "Error al cambiar contraseña" }
                    username = $data.username
                } | ConvertTo-Json
                
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseData)
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            else {
                $response.StatusCode = 404
                $responseData = @{ error = "Endpoint no encontrado" } | ConvertTo-Json
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseData)
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
            
            $response.Close()
        }
        catch {
            Write-Error "Error en el servidor: $($_.Exception.Message)"
        }
    }
}

# Ejecutar servicio si se llama directamente
if ($MyInvocation.InvocationName -ne '.') {
    Start-PasswordWebService -Port 8080
}
