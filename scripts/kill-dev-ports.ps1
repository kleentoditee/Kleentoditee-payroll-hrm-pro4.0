# Free dev ports: API 8787, admin 3000, tracker 3001.
# Uses netstat + taskkill instead of Get-NetTCPConnection, which can hang
# on some Windows builds when the network stack or WMI is slow.
param(
  [int[]] $Ports = @(3000, 3001, 8787)
)

$ErrorActionPreference = "SilentlyContinue"
$pids = New-Object "System.Collections.Generic.HashSet[int]"

$netstat = netstat -ano 2>$null
if (-not $netstat) {
  exit 0
}

foreach ($line in $netstat) {
  if ($line -notmatch "LISTENING") {
    continue
  }
  $hit = $false
  foreach ($port in $Ports) {
    if ($line -match (":" + $port + "\s")) {
      $hit = $true
      break
    }
  }
  if (-not $hit) {
    continue
  }
  if ($line -match "(\d+)\s*$") {
    $id = [int]$Matches[1]
    if ($id -gt 0) {
      [void]$pids.Add($id)
    }
  }
}

foreach ($id in $pids) {
  taskkill /PID $id /F 2>$null | Out-Null
}

exit 0
