# VeloTrack

Real-time download/upload speed and latency in the Chrome/Edge toolbar.

    Windows adapter counters -> velotrack_host.py (psutil, 1 Hz) -> Native Messaging -> background.js -> badge + popup

## Requirements
Windows 10/11, Chrome or Edge 110+, Python 3.8+ on PATH.

## Setup
1. Load the extension
   - Chrome: chrome://extensions -> Developer mode -> Load unpacked -> select this project folder (the one that directly contains `manifest.json`)
   - Edge: edge://extensions -> Developer mode -> Load unpacked -> select this project folder (the one that directly contains `manifest.json`)
   - Copy the extension ID from its card (Chrome and Edge IDs differ).
2. Register the native host (PowerShell, inside `native-host/`):

       Set-ExecutionPolicy -Scope Process Bypass
       .\install.ps1 -ExtensionId <ID>
       .\install.ps1 -ExtensionId <CHROME_ID>,<EDGE_ID>    # both browsers

   Installs `psutil`, writes `com.velotrack.host.json`, and registers it under HKCU for Chrome and Edge (no admin rights).
3. Reload the extension and pin VeloTrack to the toolbar.

Uninstall: run `native-host/uninstall.ps1`, then remove the extension.

## Notes
- Speeds are system-wide for the adapter carrying your default route. With a VPN active, that is the VPN adapter.
- Badge shows the download speed as `4.8↓`, `850↓`, `25↓`. Colour gives the unit: amber = KB/s, blue = MB/s, teal = Mbps. Hover for the full readout. The popup's unit chip switches MB/s <-> Mbps.
- Ping = HTTP round-trip to https://www.gstatic.com/generate_204, refreshed every 10 s (3 requests, cold first one discarded). Not ICMP.
- Connection type (Wi-Fi/Ethernet/VPN) is inferred from the Windows adapter name.
- Helper errors are logged to `native-host/host-error.log`.
