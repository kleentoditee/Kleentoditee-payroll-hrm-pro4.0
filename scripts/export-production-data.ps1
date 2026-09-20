$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env"
$backupRoot = Join-Path $repoRoot "deployment-backups"
$uploadsPath = Join-Path $repoRoot "apps\api\uploads\hr"
$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "The root .env file is missing."
}
if (-not $pgDump -or -not (Test-Path -LiteralPath $pgDump)) {
  throw "PostgreSQL backup tools were not found at $pgDump."
}

$databaseLine = Get-Content -LiteralPath $envPath |
  Where-Object { $_ -match '^DATABASE_URL=' } |
  Select-Object -First 1
if (-not $databaseLine) {
  throw "DATABASE_URL is missing from the root .env file."
}

$databaseUrl = ($databaseLine -replace '^DATABASE_URL=', '').Trim().Trim('"').Trim("'")
# Prisma accepts `schema=public`; PostgreSQL command-line tools do not.
$databaseUrl = $databaseUrl -replace '([?&])schema=[^&]*', '$1'
$databaseUrl = ($databaseUrl -replace '\?&', '?').TrimEnd('?', '&')
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$dumpPath = Join-Path $outputDir "kleentoditee-postgres.dump"
& $pgDump --format=custom --no-owner --no-acl --file=$dumpPath $databaseUrl
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL backup failed."
}

$filesZip = Join-Path $outputDir "employee-files.zip"
if (Test-Path -LiteralPath $uploadsPath) {
  $files = Get-ChildItem -LiteralPath $uploadsPath -File -Recurse -ErrorAction SilentlyContinue
  if ($files.Count -gt 0) {
    Compress-Archive -Path (Join-Path $uploadsPath '*') -DestinationPath $filesZip -CompressionLevel Optimal
  }
}

$manifest = @(
  "Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
  "Database: kleentoditee-postgres.dump"
  "Employee files: $(if (Test-Path -LiteralPath $filesZip) { 'employee-files.zip' } else { 'none' })"
  "Contains sensitive HR and payroll data. Keep private and delete transfer copies after verification."
)
Set-Content -LiteralPath (Join-Path $outputDir "README.txt") -Value $manifest -Encoding UTF8

Write-Host "Migration backup created: $outputDir"
