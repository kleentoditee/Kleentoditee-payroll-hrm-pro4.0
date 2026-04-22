# Sets ALLOW_DEV_EMERGENCY_LOGIN=1 in repo root .env (idempotent, UTF-8 no BOM)
param(
  [Parameter(Mandatory = $true)]
  [string]$Root
)
$ErrorActionPreference = "Stop"
$envFile = Join-Path $Root ".env"
$example = Join-Path $Root ".env.example"

if (-not (Test-Path $envFile)) {
  if (Test-Path $example) {
    Copy-Item -LiteralPath $example -Destination $envFile
    Write-Host "Created .env from .env.example"
  } else {
    throw "No .env or .env.example in: $Root"
  }
}

$raw = Get-Content -LiteralPath $envFile -Raw
if ($null -eq $raw) { $raw = "" }
$lines = $raw -split "`r?`n" | ForEach-Object { $_ }
$pattern = '^\s*ALLOW_DEV_EMERGENCY_LOGIN\s*='

$out = [System.Collections.ArrayList]@()
$replaced = $false
foreach ($line in $lines) {
  if ($line -match $pattern) {
    [void]$out.Add("ALLOW_DEV_EMERGENCY_LOGIN=1")
    $replaced = $true
  } else {
    [void]$out.Add($line)
  }
}
if (-not $replaced) {
  if ($out.Count -gt 0 -and $out[$out.Count - 1] -ne "") { [void]$out.Add("") }
  [void]$out.Add("ALLOW_DEV_EMERGENCY_LOGIN=1")
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines($envFile, $out, $utf8NoBom)
Write-Host "OK: $envFile now has ALLOW_DEV_EMERGENCY_LOGIN=1"
Write-Host "Restart the API: Ctrl+C in start-platform, then start-platform.bat"
Write-Host "You should see: [api] Emergency passwordless login is ON"
