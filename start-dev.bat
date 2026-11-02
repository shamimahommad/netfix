@echo off
echo ========================================================
echo   NetFix - Enterprise ISP SaaS (Pure PHP + MySQL + React)
echo ========================================================
echo.
echo [1/2] Starting Pure PHP REST API Server on http://127.0.0.1:4000 ...
start "NetFix PHP Backend (Port 4000)" php -S 127.0.0.1:4000 -t backend backend/index.php

echo [2/2] Starting Enterprise React Frontend on http://localhost:4001 ...
cd frontend
call npm run dev
