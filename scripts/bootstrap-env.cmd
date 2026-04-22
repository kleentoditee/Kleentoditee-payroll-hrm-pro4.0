@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

rem --- Prereq: Node.js 20+ (npm comes with the official Windows installer) ---
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [X] Node.js is not installed or not on PATH.
  echo      Install Node 20+ LTS, then open a NEW terminal and run start-platform.bat again.
  echo      One command ^(PowerShell or CMD^):
  echo        winget install -e --id OpenJS.NodeJS.LTS
  echo.
  exit /b 1
)

node -e "process.exit(+process.versions.node.split('.')[0] < 20 ? 1 : 0)" 2>nul
if errorlevel 1 (
  echo.
  echo  [X] Node.js 20 or newer is required. Current:
  node -v
  echo      Upgrade: winget install -e --id OpenJS.NodeJS.LTS
  echo.
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    echo  [env] First run: creating .env from .env.example
    copy /Y ".env.example" ".env" >nul
    if errorlevel 1 (
      echo  [X] Could not create .env
      exit /b 1
    )
  ) else (
    echo  [X] Missing .env and .env.example in %CD%
    exit /b 1
  )
)

endlocal
exit /b 0
