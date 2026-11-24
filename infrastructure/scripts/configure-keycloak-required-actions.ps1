# Active l'action requise "Update Password" du realm legalflow.
# Sans elle, le lien d'invitation d'un client affiche "Your account has been updated" sans demander de mot de passe.
# Idempotent : peut etre relance sans risque.
$ErrorActionPreference = 'Stop'

$keycloakUrl = 'http://localhost:8080'
$realm = 'legalflow'

$tokenResponse = Invoke-RestMethod -Method Post `
    -Uri "$keycloakUrl/realms/master/protocol/openid-connect/token" `
    -ContentType 'application/x-www-form-urlencoded' `
    -Body @{ client_id = 'admin-cli'; grant_type = 'password'; username = 'admin'; password = 'admin' }
$headers = @{ Authorization = "Bearer $($tokenResponse.access_token)" }
$base = "$keycloakUrl/admin/realms/$realm/authentication"

function Get-RequiredAction {
    try {
        return Invoke-RestMethod -Method Get -Uri "$base/required-actions/UPDATE_PASSWORD" -Headers $headers
    } catch {
        return $null
    }
}

$action = Get-RequiredAction

if ($null -eq $action) {
    Write-Output "UPDATE_PASSWORD n'est pas enregistree dans le realm : enregistrement."
    $registration = @{ providerId = 'UPDATE_PASSWORD'; name = 'Update Password' } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$base/register-required-action" -Headers $headers `
        -ContentType 'application/json' -Body $registration | Out-Null
    $action = Get-RequiredAction
}

if ($null -eq $action) {
    throw "Impossible d'enregistrer UPDATE_PASSWORD. Activez-la a la main : console Keycloak, Authentication, Required actions, Update Password."
}

if (-not $action.enabled) {
    $action.enabled = $true
    Invoke-RestMethod -Method Put -Uri "$base/required-actions/UPDATE_PASSWORD" -Headers $headers `
        -ContentType 'application/json' -Body ($action | ConvertTo-Json -Depth 5) | Out-Null
}

$check = Get-RequiredAction
if ($check -and $check.enabled) {
    Write-Output 'PASS: l''action requise Update Password est activee : un client invite pourra choisir son mot de passe.'
} else {
    throw 'Update Password n''est toujours pas activee.'
}
