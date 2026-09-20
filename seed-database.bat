@echo off
setlocal EnableExtensions
title KleenToDiTee - seed database (admin user + templates)
cd /d "%~dp0"

call "%~dp0scripts\bootstrap-env.cmd"
if errorlevel 1 goto :fail

echo.
echo  This replaces demo data: clears users, employees, time entries, templates, audit.
echo  If you see "database is locked", stop the dev servers first, then re-run.
echo  PostgreSQL can be native Windows PostgreSQL or Docker Compose.
echo  If this fails, run: npm run db:doctor
echo.

call npm run db:wait
if errorlevel 1 goto :fail

call npm run db:seed
if errorlevel 1 (
  echo.
  echo  Seed failed. See messages above. Try stopping API/admin/tracker first, then re-run.
  goto :fail
)
echo.
echo  Done. Log in with (unless you set SEED_ADMIN_* in .env):
echo    admin@kleentoditee.local
echo    ChangeMe!Dev123
echo.
pause
endlocal
exit /b 0

:fail
echo.
pause
endlocal
exit /b 1
