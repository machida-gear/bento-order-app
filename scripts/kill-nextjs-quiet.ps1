# Kill Next.js dev server processes quietly (non-interactive)
# This script kills Node.js processes related to Next.js and removes lock files

# Set encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Function to kill a process by ID
function Kill-ProcessSafe {
    param([int]$ProcessId)
    try {
        $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $ProcessId -Force -ErrorAction Stop
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Get all Node.js processes
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
$killedCount = 0

foreach ($proc in $nodeProcesses) {
    try {
        $cmdLine = (Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
        if ($cmdLine -like "*next*" -or ($cmdLine -like "*npm*" -and $cmdLine -like "*dev*")) {
            if (Kill-ProcessSafe -ProcessId $proc.Id) {
                $killedCount++
            }
        }
    } catch {
        # If we can't check command line, try to kill it anyway if it's using ports 3000-3002
        $ports = @(3000, 3001, 3002)
        $shouldKill = $false
        foreach ($port in $ports) {
            $connections = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
            foreach ($conn in $connections) {
                if ($conn -match '\s+(\d+)\s*$') {
                    $pid = [int]$matches[1]
                    if ($pid -eq $proc.Id) {
                        $shouldKill = $true
                        break
                    }
                }
            }
            if ($shouldKill) { break }
        }
        if ($shouldKill) {
            if (Kill-ProcessSafe -ProcessId $proc.Id) {
                $killedCount++
            }
        }
    }
}

# Wait a bit for processes to exit
if ($killedCount -gt 0) {
    Start-Sleep -Milliseconds 1000
}

# Remove lock file
$lockFile = Join-Path $PSScriptRoot "..\.next\dev\lock"
if (Test-Path $lockFile) {
    try {
        Remove-Item $lockFile -Force -ErrorAction Stop
    } catch {
        # Ignore errors if file is locked (process might still be exiting)
        Start-Sleep -Milliseconds 500
        try {
            Remove-Item $lockFile -Force -ErrorAction Stop
        } catch {
            # Final attempt failed, but that's okay
        }
    }
}
