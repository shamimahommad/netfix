@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   NetFix - Enterprise ISP SaaS (Pure PHP + MySQL + React)
echo ========================================================
echo.

:: 1. Check if MySQL is running on port 3306; start if needed
netstat -ano | findstr :3306 >nul
if errorlevel 1 (
    echo [*] Starting MySQL Database Server...
    if exist "C:\xampp\mysql\bin\mysqld.exe" (
        start "XAMPP MySQL Daemon" /min /D "C:\xampp" "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --console
        timeout /t 1 /nobreak >nul
    ) else (
        echo [!] Please start MySQL from your XAMPP Control Panel.
    )
) else (
    echo [*] MySQL Database is already active on port 3306.
)

:: 2. Check PHP on port 4000
netstat -ano | findstr :4000 >nul
if errorlevel 1 (
    echo [*] Starting PHP Backend API on http://127.0.0.1:4000 ...
    start "NetFix PHP Backend (Port 4000)" /min php -S 127.0.0.1:4000 -t backend backend/index.php
    timeout /t 1 /nobreak >nul
) else (
    echo [*] PHP API is already active on port 4000.
)

:: 3. Check Vite on port 4001
netstat -ano | findstr :4001 >nul
if errorlevel 1 (
    echo [*] Starting React Frontend on http://127.0.0.1:4001 ...
    start "NetFix React Vite (Port 4001)" /min cmd /c "npm --prefix frontend run dev"
    timeout /t 1 /nobreak >nul
) else (
    echo [*] React Frontend is already active on port 4001.
)

echo.
echo ========================================================
echo   All NetFix Services are UP & RUNNING!
echo   Open: http://localhost:4001/dashboard
echo ========================================================
