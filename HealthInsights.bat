@echo off
title Health Insights
echo Starting Health Insights...
echo.

:: Start the dev server in WSL (port 3000)
echo Starting frontend server...
start /B wsl.exe -d Ubuntu -- bash -c "cd /home/stuart/health-insights && npm run dev"

:: Start the file import server in WSL (port 3001)
echo Starting file import server...
start /B wsl.exe -d Ubuntu -- bash -c "cd /home/stuart/health-insights && node server.cjs"

:: Wait for servers to start
echo Waiting for servers to start...
timeout /t 4 /nobreak > nul

:: Open browser
echo Opening browser...
start http://localhost:3000

echo.
echo ============================================
echo Health Insights is running!
echo.
echo Frontend: http://localhost:3000
echo Import Server: http://localhost:3001
echo ============================================
echo.
echo Close this window to stop the servers.
pause
