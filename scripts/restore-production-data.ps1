param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDirectory,

  [string]$TargetDatabaseUrl,

  [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmRestore) {
  throw "Restore changes the target database. Run again with -ConfirmRestore after checking the backup and target."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backupRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "deployment-backups"))
$resolvedBackup = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $BackupDirectory).Path)
if (-not $resolvedBackup.StartsWith($backupRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "For safety, the backup directory must be inside $backupRoot"
}

$dumpPath = Join-Path $resolvedBackup "kleentoditee-postgres.dump"
if (-not (Test-Path -LiteralPath $dumpPath)) {
  throw "The backup does not contain kleentoditee-postgres.dump."
}

if (-not $TargetDatabaseUrl) {
  $envPath = Join-Path $repoRoot ".env"
  $databaseLine = Get-Content -LiteralPath $envPath |
    Where-Object { $_ -match '^DATABASE_URL=' } |
    Select-Object -First 1
  if (-not $databaseLine) {
    throw "DATABASE_URL is missing from .env."
  }
  $TargetDatabaseUrl = ($databaseLine -replace '^DATABASE_URL=', '').Trim().Trim('"').Trim("'")
}

$TargetDatabaseUrl = $TargetDatabaseUrl -replace '([?&])schema=[^&]*', '$1'
$TargetDatabaseUrl = ($TargetDatabaseUrl -replace '\?&', '?').TrimEnd('?', '&')
$pgRestore = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_restore.exe" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $pgRestore) {
  throw "PostgreSQL restore tools were not found."
}

& $pgRestore --clean --if-exists --no-owner --no-acl --dbname=$TargetDatabaseUrl $dumpPath
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL restore failed. Employee files were not changed."
}

$filesZip = Join-Path $resolvedBackup "employee-files.zip"
if (Test-Path -LiteralPath $filesZip) {
  $uploadsPath = Join-Path $repoRoot "apps\api\uploads\hr"
  New-Item -ItemType Directory -Path $uploadsPath -Force | Out-Null
  Expand-Archive -LiteralPath $filesZip -DestinationPath $uploadsPath -Force
}

Write-Host "Restore completed from $resolvedBackup"
Write-Host "Start the platform and verify sign-in, employee counts, payroll history, and document downloads."
