@echo off
echo ========================================================
echo   NetFix - ISP Billing ^& Bandwidth Management SaaS
echo ========================================================
echo.
echo [1/2] Starting Core PHP REST API Server on http://127.0.0.1:8000 ...
start "NetFix PHP Backend (Port 8000)" php -S 127.0.0.1:8000 -t backend backend/index.php

echo [2/2] Starting React + Vite Frontend on http://localhost:3000 ...
cd frontend
call npm run dev
