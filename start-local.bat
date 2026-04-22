@echo off
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [X] Python is not on PATH. Install Python 3, then run this again.
  echo      Example:  winget install -e --id Python.Python.3.12
  echo.
  pause
  exit /b 1
)
echo Starting Kleentoditee Payroll Pro (legacy static app) on http://localhost:8081
start "Kleentoditee Payroll Pro Server" cmd /k python -m http.server 8081
timeout /t 2 /nobreak >nul
start "" http://localhost:8081/index.html
