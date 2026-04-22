@echo off
title KleenToDiTee — seed database (admin user + templates)
cd /d "%~dp0"

call "%~dp0scripts\bootstrap-env.cmd"
if errorlevel 1 goto :fail

echo.
echo  This replaces demo data: clears users, employees, time entries, templates, audit.
echo  If you see "database is locked", stop the dev servers (Ctrl+C) first, then re-run.
echo.

call npm run db:seed
if errorlevel 1 (
  echo.
  echo  Seed failed. See messages above. Try stopping API/admin first, then re-run.
  goto :fail
)
echo.
echo  Done. Log in with (unless you set SEED_ADMIN_* in .env):
echo    admin@kleentoditee.local
echo    ChangeMe!Dev123
echo.
pause
exit /b 0

:fail
echo.
pause
exit /b 1
