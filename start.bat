@echo off
title PulseFlow AI - Decoupled Platform Starter
echo ========================================================
echo   PulseFlow AI: Autonomous Workflow Orchestrator
echo   Decoupled Architecture:
echo   - Backend API Gateway: http://localhost:5000
echo   - Frontend Presentation: http://localhost:5173
echo ========================================================

set PATH=C:\Program Files\nodejs;%PATH%

echo [1/2] Starting Backend Orchestrator on Port 5000...
start "PulseFlow Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run start"

echo [2/2] Starting Frontend Vite Server on Port 5173...
start "PulseFlow Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak > nul
echo Opening PulseFlow AI in browser...
start http://localhost:5173

echo ========================================================
echo   Both services are now running in dedicated windows.
echo   Press any key to close this launcher.
echo ========================================================
pause
