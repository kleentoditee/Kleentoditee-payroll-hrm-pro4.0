@echo off
setlocal
cd /d "%~dp0"
title Repair Prisma — EPERM / query engine rename
echo.
echo  When Prisma shows EPERM (rename of query_engine-*.dll.node), Windows or OneDrive
echo  is blocking files under node_modules\.prisma
echo.
echo  Do this first:
echo   1) Stop dev servers: Ctrl+C in the window that runs start-platform
echo   2) Close any other CMD/PowerShell in this same project folder
echo   3) Optional: OneDrive - right-click this folder, choose "Always keep on this device"
echo.
set /p KILL=Type Y to force-stop ALL Node on this computer, or N to skip: 
if /i "%KILL%"=="Y" (
  echo Stopping node.exe ...
  taskkill /F /IM node.exe 2>nul
  timeout /t 2 /nobreak >nul
)

echo Removing Prisma download folders under node_modules ^(stale locks cause EPERM^)...
if exist "node_modules\.prisma" (
  rmdir /s /q "node_modules\.prisma" 2>nul
)
if exist "node_modules\@prisma" (
  rmdir /s /q "node_modules\@prisma" 2>nul
)
timeout /t 1 /nobreak >nul
if exist "node_modules\.prisma" (
  echo.
  echo  [X] Could not delete node_modules\.prisma — still locked.
  echo  - Close this folder in Explorer, other terminals, and Cursor. Pause OneDrive sync for this folder if you can.
  echo  - Best fix: copy or clone the project OUTSIDE OneDrive, e.g.  C:\dev\kleentoditee-payroll-pro
  echo    then: npm install  and  repair-prisma-generate.bat
  echo.
  goto :end
)

call "%~dp0scripts\bootstrap-env.cmd" || goto :end
echo Running npm run db:generate ...
call npm run db:generate
if errorlevel 1 (
  echo.
  echo  [X] generate failed. If you are under OneDrive\Documents, move the whole repo to C:\dev\...
  echo  and run repair-prisma-generate.bat again.
) else (
  echo.
  echo  OK. Next: npm run db:push  ^(or just run start-platform.bat^)
  echo.
)

:end
pause
endlocal
exit /b 0
