$name = 'com.velotrack.host'
foreach ($key in @("HKCU:\Software\Google\Chrome\NativeMessagingHosts\$name",
                   "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$name")) {
  Remove-Item -Path $key -ErrorAction SilentlyContinue
}
Remove-Item (Join-Path $PSScriptRoot "$name.json") -ErrorAction SilentlyContinue
Write-Host "VeloTrack native host unregistered."
