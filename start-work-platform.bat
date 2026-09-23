@echo off
setlocal EnableExtensions
title KleenToDiTee - start work platform
set "EXPECTED_ROOT=C:\Kleentoditee Payroll HRM"
set "APP_DIR=%EXPECTED_ROOT%\Kleentoditee-payroll-hrm-pro4.0"

cd /d "%EXPECTED_ROOT%" 2>nul
if /I not "%CD%"=="%EXPECTED_ROOT%" (
  echo Wrong folder open. Please open C:\Kleentoditee Payroll HRM before continuing.
  goto :fail
)

if not exist "%APP_DIR%\package.json" (
  echo.
  echo [X] Missing package.json:
  echo     "%APP_DIR%\package.json"
  goto :fail
)

cd /d "%APP_DIR%" || goto :fail

call "%APP_DIR%\scripts\bootstrap-env.cmd"
if errorlevel 1 goto :fail

echo.
echo  ============================================================
echo   KLEENTODITEE PAYROLL HRM - WORK MODE
echo  ============================================================
echo.
echo  This starts the app without resetting demo data.
echo.
echo    Admin:            http://localhost:3000
echo    Employee tracker: http://localhost:3001
echo    API:              http://localhost:8787
echo.

if not exist "%APP_DIR%\node_modules" (
  echo [setup] node_modules missing - installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
  echo.
)

echo [browser] The Admin sign-in page will open when the platform is ready.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 8; Start-Process 'http://localhost:3000/login'"

call npm run start:work
if errorlevel 1 goto :fail

endlocal
exit /b 0

:fail
echo.
echo [X] Startup failed. From the repo root, run:
echo     npm run db:doctor
echo.
pause
endlocal
exit /b 1
