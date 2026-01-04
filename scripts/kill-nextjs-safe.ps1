# Kill Next.js dev server processes
# This script kills processes using ports 3000 or 3001 and removes lock files

# Set encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Searching for Next.js dev server processes..." -ForegroundColor Yellow

# Search for processes using ports 3000 and 3001
$ports = @(3000, 3001)
$processesToKill = @()

foreach ($port in $ports) {
    $connections = netstat -ano | Select-String ":$port\s"
    foreach ($connection in $connections) {
        if ($connection -match '\s+(\d+)\s*$') {
            $processId = $matches[1]
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process -and ($process.ProcessName -eq "node" -or $process.ProcessName -eq "next")) {
                $processesToKill += $process
            }
        }
    }
}

# Remove lock file
$lockFile = Join-Path $PSScriptRoot "..\.next\dev\lock"
if (Test-Path $lockFile) {
    Write-Host "Lock file found: $lockFile" -ForegroundColor Yellow
    try {
        Remove-Item $lockFile -Force -ErrorAction Stop
        Write-Host "[OK] Lock file removed" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Failed to remove lock file: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($processesToKill.Count -eq 0) {
    Write-Host "No running Next.js processes found" -ForegroundColor Green
} else {
    Write-Host "The following processes will be terminated:" -ForegroundColor Yellow
    foreach ($proc in $processesToKill) {
        Write-Host "  - PID: $($proc.Id), Process: $($proc.ProcessName), Path: $($proc.Path)" -ForegroundColor Cyan
    }
    
    $confirm = Read-Host "Terminate these processes? (Y/N)"
    if ($confirm -eq "Y" -or $confirm -eq "y") {
        foreach ($proc in $processesToKill) {
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                Write-Host "[OK] Process $($proc.Id) terminated" -ForegroundColor Green
            } catch {
                Write-Host "[ERROR] Failed to terminate process $($proc.Id): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        Write-Host "`nDone. Please run 'npm run dev' again." -ForegroundColor Green
    } else {
        Write-Host "Cancelled" -ForegroundColor Yellow
    }
}
