@echo off
setlocal
title Copy project to C:\dev (skip node_modules) — OneDrive / Prisma EPERM fix
rem This file lives in scripts\; repo root is one level up
cd /d "%~dp0.."
set "HERE=%CD%"
set "DEST=C:\dev\kleentoditee-payroll-pro"

echo.
echo  This runs robocopy of THIS repo to:
echo   %DEST%
echo  Excluding: node_modules, .next, build output — you will run npm install there.
echo.
set /p OK=Type Y to continue, or N to cancel: 
if /i not "%OK%"=="Y" exit /b 0

if not exist "C:\dev" mkdir "C:\dev" 2>nul

rem /MIR is dangerous here — we /E copy non-excluded, no delete at dest
robocopy "%HERE%" "%DEST%" /E /XD node_modules .next /XF *.log
if errorlevel 8 (
  echo  robocopy reported an error. Code: %errorlevel%
  echo  See: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/robocopy#exit-codes
  goto :end
)
echo.
echo  Done. Next in a NEW command prompt:
echo   cd /d C:\dev\kleentoditee-payroll-pro
echo   if not exist .env  copy /Y .env.example .env
echo   npm install
echo   start-platform.bat
echo.
echo  If the copy missed hidden files, run from Explorer: show hidden items, or use  git worktree  /  git clone  into C:\dev
echo  instead, then again skip copying node_modules by deleting C:\dev\...\node_modules and running npm install.
echo.

:end
pause
endlocal
