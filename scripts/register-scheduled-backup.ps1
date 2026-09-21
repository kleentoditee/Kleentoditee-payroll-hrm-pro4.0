# Registers a daily scheduled backup (Postgres dump + employee files zip) via
# Windows Task Scheduler. Run once as the machine user:
#   powershell -File scripts/register-scheduled-backup.ps1
# Optional: -Time "02:17" to change the daily fire time.

param(
  [string]$Time = "02:17",
  [string]$TaskName = "KleenToDiTee Daily Backup"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $repoRoot "scripts\export-production-data.ps1"
if (-not (Test-Path -LiteralPath $backupScript)) {
  throw "Backup script not found at $backupScript"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Daily KleenToDiTee Postgres dump + employee files backup to deployment-backups\" `
  -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered: daily at $Time."
Write-Host "Verify with: Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "Run a restore drill monthly: scripts\restore-drill.ps1"
