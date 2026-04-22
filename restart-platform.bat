@echo off
title KleenToDiTee — Restart (kill ports + DB sync + dev)
cd /d "%~dp0"

call "%~dp0scripts\bootstrap-env.cmd"
if errorlevel 1 goto :fail

echo.
echo  FOLDER: %CD%
echo.

echo Stopping anything on ports 3000 and 8787...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\kill-dev-ports.ps1"
timeout /t 1 /nobreak >nul

if not exist "%~dp0node_modules\concurrently\package.json" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
  echo.
)

echo Syncing database schema...
call npm run db:sync
if errorlevel 1 (
  echo db:sync failed.
  goto :fail
)
echo.

echo Starting API + Admin — Ctrl+C stops BOTH.
call npm run dev:all
if errorlevel 1 goto :fail
goto :eof

:fail
pause
