@echo off
setlocal
rem Let Next.js finish "Ready" before opening the default browser.
timeout /t 6 /nobreak >nul
rem Try default handler; fall back to unquoted start / explorer
start "" "http://localhost:3000"
if errorlevel 1 start http://localhost:3000
if errorlevel 1 explorer "http://localhost:3000"
endlocal
exit /b 0
