@echo off
setlocal EnableExtensions
title KleenToDiTee - restart reliable platform
set "EXPECTED_ROOT=C:\Kleentoditee Payroll HRM"
set "APP_DIR=%EXPECTED_ROOT%\Kleentoditee-payroll-hrm-pro4.0"

cd /d "%EXPECTED_ROOT%" 2>nul
if /I not "%CD%"=="%EXPECTED_ROOT%" (
  echo Wrong folder open. Please open C:\Kleentoditee Payroll HRM in Cursor before continuing.
  pause
  exit /b 1
)

call "%APP_DIR%\scripts\bootstrap-env.cmd"
if errorlevel 1 goto :fail

echo.
echo  Workspace root: "%EXPECTED_ROOT%"
echo.
echo Stopping anything on ports 3000, 3001, 8787...
powershell -NoProfile -ExecutionPolicy Bypass -File "%APP_DIR%\scripts\kill-dev-ports.ps1"
if errorlevel 1 (
  echo kill-dev-ports.ps1 reported an error; continuing anyway.
)
timeout /t 2 /nobreak >nul

call "%APP_DIR%\start-platform.bat"
endlocal
exit /b %ERRORLEVEL%

:fail
pause
endlocal
exit /b 1
