@echo off
setlocal
cd /d "%~dp0.."
title Set Git remote and push to GitHub
echo Repo root: %CD%
echo.

git rev-parse --is-inside-work-tree 2>nul
if errorlevel 1 (
  echo  [X] This folder is not a Git repo yet. Run in this directory:
  echo     git init
  echo     git add -A
  echo     git commit -m "Initial commit"
  echo  Then run this script again.
  goto :end
)

git remote get-url origin 2>nul
if errorlevel 1 (
  echo  Adding origin...
  git remote add origin "https://github.com/kleentoditee/Kleentoditee-payroll-hrm-pro4.0.git"
) else (
  echo  Remote origin already exists. Updating URL to GitHub URL...
  git remote set-url origin "https://github.com/kleentoditee/Kleentoditee-payroll-hrm-pro4.0.git"
)

git branch -M main
echo.
echo  Pushing. You may need to sign in: GitHub web login, or a Personal Access Token for HTTPS^).
echo  If the repo is new and empty, this should work. If the remote has commits, use: git pull origin main --rebase  first.
echo.
git push -u origin main
if errorlevel 1 (
  echo.
  echo  Push failed. Common fixes: log in to GitHub, create the empty repo on GitHub, or if histories differ: git pull origin main --allow-unrelated-histories
  goto :end
)
echo  Done.

:end
pause
endlocal
