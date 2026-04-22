@echo off
title KleenToDiTee — set ALLOW_DEV_EMERGENCY_LOGIN in .env
cd /d "%~dp0"
echo  Repo root: %CD%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\patch-env-emergency.ps1" -Root "%CD%"
if errorlevel 1 (
  echo.
  echo  [X] PowerShell step failed. Run this from the same folder that contains start-platform.bat
  echo.
  pause
  exit /b 1
)
echo.
echo  Next: close the start-platform window (Ctrl+C) and run start-platform.bat again.
echo  In the log, you must see:  [api] Emergency passwordless login is ON
echo.
pause
exit /b 0
