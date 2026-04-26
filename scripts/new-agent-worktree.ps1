param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("codex", "claude", "cursor")]
  [string]$Agent,

  [Parameter(Mandatory = $true)]
  [string]$Lane,

  [string]$BaseBranch = "",
  [string]$WorktreeRoot = "C:\dev\kleentoditee-worktrees"
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "Run this script inside the KleenToDiTee git repo."
}

if (-not $BaseBranch) {
  $BaseBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
}

$slug = $Lane.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
$slug = $slug.Trim("-")
if (-not $slug) {
  throw "Lane must contain at least one letter or number."
}

$branch = "agent/$Agent/$slug"
$worktreePath = Join-Path $WorktreeRoot "$Agent-$slug"

Write-Host "Repo:      $repoRoot"
Write-Host "Base:      $BaseBranch"
Write-Host "Branch:    $branch"
Write-Host "Worktree:  $worktreePath"

if (Test-Path $worktreePath) {
  Write-Host "Worktree folder already exists. Checking status..."
  Invoke-Git -C $worktreePath status -sb
  exit 0
}

New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null

& git show-ref --verify --quiet "refs/heads/$branch"
$existingBranch = $LASTEXITCODE
if ($existingBranch -eq 0) {
  Invoke-Git worktree add $worktreePath $branch
} else {
  Invoke-Git worktree add -b $branch $worktreePath $BaseBranch
}

$envPath = Join-Path $repoRoot ".env"
$targetEnvPath = Join-Path $worktreePath ".env"
if ((Test-Path $envPath) -and -not (Test-Path $targetEnvPath)) {
  Copy-Item -LiteralPath $envPath -Destination $targetEnvPath
  Write-Host "Copied .env into worktree."
}

Write-Host ""
Write-Host "Ready. Next commands:"
Write-Host "  cd `"$worktreePath`""
Write-Host "  npm install"
Write-Host "  npm.cmd run db:generate"
Write-Host "  git status -sb"
