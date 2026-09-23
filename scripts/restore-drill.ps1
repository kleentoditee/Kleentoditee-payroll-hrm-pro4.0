# Restore drill (Batch 16 Gate B): proves the LATEST backup actually restores,
# by loading it into a scratch database and checking row counts. Never touches
# the live database. Safe to run any time:
#   powershell -File scripts/restore-drill.ps1

param(
  [string]$ScratchDatabase = "kleentoditee_restore_drill",
  # Optional superuser/admin URL used to create/drop the scratch DB and run the
  # restore. Needed when the app user lacks CREATEDB (the default least-
  # privilege setup). Falls back to the app DATABASE_URL.
  # Example: -AdminDatabaseUrl "postgresql://postgres@localhost:5432/postgres"
  [string]$AdminDatabaseUrl = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $repoRoot "deployment-backups"
$latest = Get-ChildItem -LiteralPath $backupRoot -Directory -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $latest) {
  throw "No backups found under $backupRoot. Run scripts\export-production-data.ps1 first."
}
$dumpPath = Join-Path $latest.FullName "kleentoditee-postgres.dump"
if (-not (Test-Path -LiteralPath $dumpPath)) {
  throw "Latest backup $($latest.Name) has no kleentoditee-postgres.dump."
}

$envPath = Join-Path $repoRoot ".env"
$databaseLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseLine) { throw "DATABASE_URL is missing from .env." }
$databaseUrl = ($databaseLine -replace '^DATABASE_URL=', '').Trim().Trim('"').Trim("'")
$databaseUrl = $databaseUrl -replace '([?&])schema=[^&]*', '$1'
$databaseUrl = ($databaseUrl -replace '\?&', '?').TrimEnd('?', '&')

$pgBin = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $pgBin) { throw "PostgreSQL tools not found." }
$psql = Join-Path $pgBin "psql.exe"
$pgRestore = Join-Path $pgBin "pg_restore.exe"

# Admin connection (same server, postgres maintenance DB). When the app user
# has no CREATEDB privilege, pass -AdminDatabaseUrl with a superuser URL; the
# scratch DB is then created, restored, queried, and dropped through it.
$baseUrl = if ($AdminDatabaseUrl) { $AdminDatabaseUrl } else { $databaseUrl }
$adminUrl = $baseUrl -replace '/[^/?]+(?=\?|$)', '/postgres'
$scratchUrl = $baseUrl -replace '/[^/?]+(?=\?|$)', "/$ScratchDatabase"

Write-Host "Drill: restoring backup $($latest.Name) into scratch DB '$ScratchDatabase'..."

& $psql $adminUrl -c "DROP DATABASE IF EXISTS $ScratchDatabase;" | Out-Null
& $psql $adminUrl -c "CREATE DATABASE $ScratchDatabase;" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not create scratch database." }

try {
  & $pgRestore --no-owner --no-acl --dbname=$scratchUrl $dumpPath 2>$null
  # pg_restore may exit non-zero on harmless NOTICEs; verify by querying.

  # SQL via temp file: Windows PowerShell mangles embedded quotes in -c args.
  $sqlFile = Join-Path $env:TEMP "ktd-restore-drill.sql"
  Set-Content -LiteralPath $sqlFile -Encoding ASCII -Value @'
SELECT (SELECT count(*) FROM "User"), (SELECT count(*) FROM "Employee"), (SELECT count(*) FROM "JournalEntry"), (SELECT count(*) FROM "Organization");
'@
  $counts = & $psql $scratchUrl -t -A -F "|" -f $sqlFile
  Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -ne 0 -or -not $counts) { throw "Sanity query failed on restored database." }
  $parts = ($counts | Select-Object -First 1) -split "\|"
  Write-Host ("Restored row counts - Users: {0}, Employees: {1}, Journal entries: {2}, Organizations: {3}" -f $parts[0], $parts[1], $parts[2], $parts[3])
  if ([int]$parts[0] -lt 1 -or [int]$parts[3] -lt 1) {
    throw "Restored database is missing users or organizations - backup is NOT trustworthy."
  }
  Write-Host "RESTORE DRILL PASSED: backup $($latest.Name) restores and contains live data."
}
finally {
  & $psql $adminUrl -c "DROP DATABASE IF EXISTS $ScratchDatabase;" | Out-Null
  Write-Host "Scratch database dropped."
}
