@echo off
setlocal EnableExtensions
set "EXPECTED_ROOT=C:\Kleentoditee Payroll HRM"
set "APP_DIR=%EXPECTED_ROOT%\Kleentoditee-payroll-hrm-pro4.0"
cd /d "%EXPECTED_ROOT%" 2>nul
if /I not "%CD%"=="%EXPECTED_ROOT%" (
  echo Wrong folder open. Please open C:\Kleentoditee Payroll HRM in Cursor before continuing.
  pause
  exit /b 1
)
cd /d "%APP_DIR%" || exit /b 1
title Repair Prisma generate
echo.
echo This repairs the generated Prisma client inside node_modules.
echo It does not delete, reset, seed, or overwrite payroll data.
echo.
echo Do this first:
echo  1. Stop dev servers: Ctrl+C in the server window
echo  2. Close other CMD/PowerShell windows in "C:\Kleentoditee Payroll HRM"
echo.
set /p KILL=Type Y to force-stop ALL Node on this computer, or N to skip:
if /i "%KILL%"=="Y" (
  echo Stopping node.exe ...
  taskkill /F /IM node.exe 2>nul
  timeout /t 2 /nobreak >nul
)

call "%APP_DIR%\scripts\bootstrap-env.cmd" || goto :end
echo Running npm run db:generate ...
call npm run db:generate
if errorlevel 1 (
  echo.
  echo [X] generate failed. Run npm install from:
  echo     "%APP_DIR%"
) else (
  echo.
  echo OK. Next: run "C:\Kleentoditee Payroll HRM\start-platform.bat"
)

:end
pause
endlocal
exit /b 0
