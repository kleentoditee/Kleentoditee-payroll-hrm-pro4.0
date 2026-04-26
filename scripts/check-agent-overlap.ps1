param(
  [string]$WorktreeRoot = "C:\dev\kleentoditee-worktrees"
)

$ErrorActionPreference = "Stop"

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "Run this script inside the KleenToDiTee git repo."
}
$resolvedWorktreeRoot = [System.IO.Path]::GetFullPath($WorktreeRoot).TrimEnd('\', '/')

$worktrees = @()
$current = @{}
foreach ($line in (& git worktree list --porcelain)) {
  if ($line -like "worktree *") {
    if ($current.Path) {
      $worktrees += [pscustomobject]$current
    }
    $current = @{ Path = $line.Substring("worktree ".Length) }
  } elseif ($line -like "branch *") {
    $current.Branch = $line.Substring("branch ".Length)
  }
}
if ($current.Path) {
  $worktrees += [pscustomobject]$current
}

$changes = @()
foreach ($tree in $worktrees) {
  if (-not (Test-Path $tree.Path)) {
    continue
  }
  $treePath = [System.IO.Path]::GetFullPath($tree.Path).TrimEnd('\', '/')
  if (-not $treePath.StartsWith($resolvedWorktreeRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    continue
  }
  $status = & git -C $tree.Path status --porcelain
  foreach ($row in $status) {
    if ($row.Length -lt 4) {
      continue
    }
    $path = $row.Substring(3)
    $changes += [pscustomobject]@{
      File = $path
      Worktree = $tree.Path
      Branch = $tree.Branch
      Status = $row.Substring(0, 2)
    }
  }
}

if ($changes.Count -eq 0) {
  Write-Host "No modified files found across git worktrees."
  exit 0
}

$overlaps = $changes | Group-Object File | Where-Object { $_.Count -gt 1 }
if ($overlaps.Count -eq 0) {
  Write-Host "No overlapping modified files found."
  $changes | Sort-Object Worktree, File | Format-Table -AutoSize
  exit 0
}

Write-Host "Overlapping modified files found:"
foreach ($group in $overlaps) {
  Write-Host ""
  Write-Host $group.Name
  $group.Group | Format-Table -AutoSize
}
exit 1

