<#
 Registers the VeloTrack native messaging host for Chrome and Edge (current user only, no admin needed).
 Usage:  .\install.ps1 -ExtensionId <id> [<id2> ...]
 Load the extension first, then copy its ID from chrome://extensions or edge://extensions.
 Chrome and Edge give different IDs - pass both if you use both.
#>
param([Parameter(Mandatory = $true)][string[]]$ExtensionId)
$ErrorActionPreference = 'Stop'

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python 3 not found on PATH. Install it from python.org (tick 'Add to PATH') and re-run."
}
python -m pip install --user --quiet -r (Join-Path $PSScriptRoot 'requirements.txt')

$name = 'com.velotrack.host'
$manifestPath = Join-Path $PSScriptRoot "$name.json"
$manifest = [ordered]@{
  name            = $name
  description     = 'VeloTrack native network statistics helper'
  path            = (Join-Path $PSScriptRoot 'velotrack_host.bat')
  type            = 'stdio'
  allowed_origins = @($ExtensionId | ForEach-Object { "chrome-extension://$($_.Trim())/" })
}
$json = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))

foreach ($key in @("HKCU:\Software\Google\Chrome\NativeMessagingHosts\$name",
                   "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$name")) {
  New-Item -Path $key -Value $manifestPath -Force | Out-Null
}
Write-Host "Installed. Reload the extension (or restart the browser) to connect." -ForegroundColor Green
