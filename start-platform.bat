@echo off
setlocal EnableExtensions
title KleenToDiTee - start platform
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
  echo.
  echo This launcher only supports the approved workspace:
  echo     "%EXPECTED_ROOT%"
  goto :fail
)

cd /d "%APP_DIR%" || goto :fail

call "%APP_DIR%\scripts\bootstrap-env.cmd"
if errorlevel 1 goto :fail

echo.
echo  ============================================================
echo   KLEENTODITEE PAYROLL HRM
echo   App directory:
echo   "%APP_DIR%"
echo  ============================================================
echo.
echo  This launcher delegates to the canonical npm workflow:
echo.
echo    npm run start:local
echo.
echo  That workflow frees dev ports, waits for PostgreSQL, runs local
echo  Prisma schema sync, seeds demo/dev data, and starts:
echo.
echo    Admin:            http://localhost:3000
echo    Employee tracker: http://localhost:3001
echo    API:              http://localhost:8787
echo.
echo  If PostgreSQL is not ready, the dev servers will not start.
echo.

if not exist "%APP_DIR%\node_modules" (
  echo [setup] node_modules missing - installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
  echo.
)

call npm run start:local
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
