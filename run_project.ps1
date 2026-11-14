# NetFix ISP SaaS - Instant 1-Click Startup Automation
param (
    [switch]$Restart
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

if ($Restart) {
    Write-Host "[*] Restarting services..." -ForegroundColor Cyan
    $portsToKill = @(4000, 4001)
    foreach ($p in $portsToKill) {
        $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 500
}

# 1. Ensure MySQL (Port 3306)
$mysqlConn = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if (-not $mysqlConn) {
    Write-Host "[*] Booting MySQL / MariaDB on port 3306..." -ForegroundColor Yellow
    if (Test-Path "C:\xampp\mysql\bin\mysqld.exe") {
        Start-Process -FilePath "C:\xampp\mysql\bin\mysqld.exe" -ArgumentList '--defaults-file="C:\xampp\mysql\bin\my.ini" --standalone' -WorkingDirectory "C:\xampp" -WindowStyle Hidden
        Start-Sleep -Milliseconds 1000
    } else {
        Write-Host "[!] C:\xampp\mysql\bin\mysqld.exe not found. Start MySQL via XAMPP." -ForegroundColor Red
    }
} else {
    Write-Host "[✓] MySQL Database is active on port 3306." -ForegroundColor Green
}

# 2. Ensure PHP REST API Server (Port 4000)
$phpConn = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if (-not $phpConn) {
    Write-Host "[*] Booting PHP REST API on http://127.0.0.1:4000..." -ForegroundColor Yellow
    cmd /c start "NetFix-PHP-Backend" /min cmd /c "cd /d $projectRoot\backend && php -S 0.0.0.0:4000 index.php"
    Start-Sleep -Milliseconds 800
} else {
    Write-Host "[✓] PHP REST API is active on port 4000." -ForegroundColor Green
}

# 3. Ensure React Vite Frontend (Port 4001)
$viteConn = Get-NetTCPConnection -LocalPort 4001 -State Listen -ErrorAction SilentlyContinue
if (-not $viteConn) {
    Write-Host "[*] Booting Vite Frontend on http://localhost:4001..." -ForegroundColor Yellow
    cmd /c start "NetFix-Vite-Frontend" /min cmd /c "cd /d $projectRoot && npm --prefix frontend run dev"
    Start-Sleep -Milliseconds 1200
} else {
    Write-Host "[✓] React Vite Frontend is active on port 4001." -ForegroundColor Green
}

# 4. Final Verification
Start-Sleep -Milliseconds 500
$activeConns = Get-NetTCPConnection -LocalPort 3306, 4000, 4001 -State Listen -ErrorAction SilentlyContinue
$activePorts = $activeConns.LocalPort

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "           NETFIX ISP SAAS - SERVICE STATUS             " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  MySQL (Port 3306) : $(if (3306 -in $activePorts) { 'ONLINE [OK]' } else { 'FAILED [OFFLINE]' })" -ForegroundColor $(if (3306 -in $activePorts) { 'Green' } else { 'Red' })
Write-Host "  PHP   (Port 4000) : $(if (4000 -in $activePorts) { 'ONLINE [OK]' } else { 'FAILED [OFFLINE]' })" -ForegroundColor $(if (4000 -in $activePorts) { 'Green' } else { 'Red' })
Write-Host "  Vite  (Port 4001) : $(if (4001 -in $activePorts) { 'ONLINE [OK]' } else { 'FAILED [OFFLINE]' })" -ForegroundColor $(if (4001 -in $activePorts) { 'Green' } else { 'Red' })
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  URL: http://localhost:4001/dashboard" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
