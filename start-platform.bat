@echo off
title KleenToDiTee - ONE-CLICK start (DB sync + API + Admin)
cd /d "%~dp0"

call "%~dp0scripts\bootstrap-env.cmd"
if errorlevel 1 goto :fail

echo %CD% | findstr /I "OneDrive" >nul
if not errorlevel 1 (
  echo.
  echo  *** WARNING: This folder is under OneDrive. Prisma can fail with EPERM on ***
  echo  ***
  echo  query_engine-windows.dll.node rename. If `db:sync` fails, use repair-prisma-generate.bat
  echo  or move the project to e.g. C:\dev\kleentoditee-payroll-pro  ^(see README^).
  echo.
)

echo.
echo  ============================================================
echo   KLEENTODITEE - THIS IS THE ONLY FOLDER YOU USE FOR NPM:
echo   %CD%
echo   (NOT TRADE-DESK-SYSTEM - that is a different project.)
echo  ============================================================
echo.
echo  This will:  npm install (if needed)  -^>  db:sync  -^>  dev servers
echo  Admin: http://localhost:3000     API: http://localhost:8787/health
echo  A browser tab should open in ~6 seconds. If it does not, open that link yourself.
echo  The window will NOT return to a prompt - that is normal. Servers run here.
echo  Press Ctrl+C to stop BOTH servers.
echo.
echo  First time with a login user? ^(With servers STOPPED, or if seed says DB locked.^)
echo    Double-click seed-database.bat   ^(same as: npm run db:seed^)
echo  ^(re-read README - seed resets users and demo data.^)
echo.

if not exist "%~dp0node_modules\concurrently\package.json" (
  echo [1/3] Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
  echo.
)

echo [2/3] Syncing database schema (Prisma generate + db push)...
call npm run db:sync
if errorlevel 1 (
  echo.
  echo  db:sync failed. If you see Prisma EPERM: stop servers, then double-click:
  echo    repair-prisma-generate.bat
  echo  If you see MODULE_NOT_FOUND ^(e.g. @prisma/engines^): from this folder run:
  echo    npm install
  echo  Or move the repo out of OneDrive to e.g. C:\dev\kleentoditee-payroll-pro
  echo  ^(OneDrive + node_modules is a common cause of rename errors.^)
  goto :fail
)
echo.

echo [3/3] Starting API + Admin...
rem Open the default browser after Next is up ^(plain cmd + start - works when PowerShell is blocked^)
start "open-admin" /min "%~dp0scripts\open-admin-delayed.cmd"
call npm run dev:all
if errorlevel 1 goto :fail
goto :eof

:fail
echo.
pause
