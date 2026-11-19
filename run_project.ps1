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

function Start-DetachedProcess {
    param(
        [string]$CommandLine,
        [string]$CurrentDirectory
    )
    $args = @{ CommandLine = $CommandLine }
    if ($CurrentDirectory) {
        $args.CurrentDirectory = $CurrentDirectory
    }
    Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments $args | Out-Null
}

# 1. Ensure MySQL (Port 3306)
$mysqlConn = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if (-not $mysqlConn) {
    Write-Host "[*] Booting MySQL / MariaDB on port 3306..." -ForegroundColor Yellow
    $scoopMysqld = "$env:USERPROFILE\scoop\apps\mariadb\current\bin\mysqld.exe"
    if (Test-Path "C:\xampp\mysql\bin\mysqld.exe") {
        Start-DetachedProcess -CommandLine 'C:\xampp\mysql\bin\mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini --standalone' -CurrentDirectory "C:\xampp"
        Start-Sleep -Milliseconds 1000
    } elseif (Test-Path $scoopMysqld) {
        $mariadbDir = "$env:USERPROFILE\scoop\apps\mariadb\current"
        Start-DetachedProcess -CommandLine "$scoopMysqld --console" -CurrentDirectory $mariadbDir
        Start-Sleep -Milliseconds 1200
    } else {
        Write-Host "[!] MySQL / MariaDB not found. Start MySQL via XAMPP or Scoop." -ForegroundColor Red
    }
} else {
    Write-Host "[OK] MySQL Database is active on port 3306." -ForegroundColor Green
}

# 2. Ensure PHP REST API Server (Port 4000)
$phpConn = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if (-not $phpConn) {
    Write-Host "[*] Booting PHP REST API on http://127.0.0.1:4000..." -ForegroundColor Yellow
    $scoopPhp = "$env:USERPROFILE\scoop\apps\php\current\php.exe"
    $phpExe = if (Test-Path "C:\xampp\php\php.exe") { "C:\xampp\php\php.exe" } elseif (Test-Path $scoopPhp) { $scoopPhp } else { "php.exe" }
    Start-DetachedProcess -CommandLine "$phpExe -S 0.0.0.0:4000 index.php" -CurrentDirectory "$projectRoot\backend"
    Start-Sleep -Milliseconds 800
} else {
    Write-Host "[OK] PHP REST API is active on port 4000." -ForegroundColor Green
}

# 3. Ensure React Vite Frontend (Port 4001)
$viteConn = Get-NetTCPConnection -LocalPort 4001 -State Listen -ErrorAction SilentlyContinue
if (-not $viteConn) {
    Write-Host "[*] Booting Vite Frontend on http://localhost:4001..." -ForegroundColor Yellow
    $scoopNode = "$env:USERPROFILE\scoop\apps\nodejs-lts\current\node.exe"
    $nodeExe = if (Test-Path "C:\PROGRA~1\nodejs\node.exe") { "C:\PROGRA~1\nodejs\node.exe" } elseif (Test-Path $scoopNode) { $scoopNode } else { "node.exe" }
    Start-DetachedProcess -CommandLine "$nodeExe node_modules/vite/bin/vite.js" -CurrentDirectory "$projectRoot\frontend"
    Start-Sleep -Milliseconds 1500
} else {
    Write-Host "[OK] React Vite Frontend is active on port 4001." -ForegroundColor Green
}

# 4. Final Verification
$activeConns = Get-NetTCPConnection -LocalPort 3306, 4000, 4001 -State Listen -ErrorAction SilentlyContinue
$activePorts = @($activeConns | ForEach-Object { $_.LocalPort })

$mysqlStatus = if ($activePorts -contains 3306) { "ONLINE [OK]" } else { "FAILED [OFFLINE]" }
$mysqlColor  = if ($activePorts -contains 3306) { "Green" } else { "Red" }

$phpStatus   = if ($activePorts -contains 4000) { "ONLINE [OK]" } else { "FAILED [OFFLINE]" }
$phpColor    = if ($activePorts -contains 4000) { "Green" } else { "Red" }

$viteStatus  = if ($activePorts -contains 4001) { "ONLINE [OK]" } else { "FAILED [OFFLINE]" }
$viteColor   = if ($activePorts -contains 4001) { "Green" } else { "Red" }

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "           NETFIX ISP SAAS - SERVICE STATUS             " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  MySQL (Port 3306) : $mysqlStatus" -ForegroundColor $mysqlColor
Write-Host "  PHP   (Port 4000) : $phpStatus" -ForegroundColor $phpColor
Write-Host "  Vite  (Port 4001) : $viteStatus" -ForegroundColor $viteColor
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  URL: http://localhost:4001/dashboard" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
