@echo off
setlocal EnableExtensions
title KleenToDiTee - legacy static prototype
cd /d "%~dp0"

echo.
echo  [LEGACY ONLY] This starts the old static payroll prototype on port 8081.
echo.
echo  It does NOT start the current Payroll HRM Pro 4.0 monorepo.
echo.
echo  Current app startup is:
echo    npm run db:doctor
echo    npm run start:local
echo.
echo  Current app URLs:
echo    Admin:            http://localhost:3000
echo    Employee tracker: http://localhost:3001
echo    API:              http://localhost:8787
echo.
set /p CONFIRM=Type LEGACY to start the old static prototype, or press Enter to cancel: 
if /I not "%CONFIRM%"=="LEGACY" (
  echo Cancelled. Use npm run start:local for the current app.
  endlocal
  exit /b 0
)

where python >nul 2>&1
if errorlevel 1 (
  echo.
  echo [X] Python is not on PATH. Install Python 3, then run this again.
  echo     Example: winget install -e --id Python.Python.3.12
  echo.
  pause
  endlocal
  exit /b 1
)

echo Starting legacy static app on http://localhost:8081
start "KleenToDiTee Legacy Static App" cmd /k python -m http.server 8081
timeout /t 2 /nobreak >nul
start "" http://localhost:8081/index.html
endlocal
exit /b 0
