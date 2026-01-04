# -*- coding: utf-8 -*-
# Next.js開発サーバーのプロセスを終了するスクリプト
# ポート3000または3001を使用しているNext.jsプロセスを終了

# エンコーディングを設定
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Next.js開発サーバーのプロセスを検索中..." -ForegroundColor Yellow

# ポート3000と3001を使用しているプロセスを検索
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

# .nextフォルダのロックファイルを使用しているプロセスを検索
$lockFile = Join-Path $PSScriptRoot "..\.next\dev\lock"
if (Test-Path $lockFile) {
    Write-Host "ロックファイルが見つかりました: $lockFile" -ForegroundColor Yellow
    # ロックファイルを削除してみる
    try {
        Remove-Item $lockFile -Force -ErrorAction Stop
        Write-Host "✓ ロックファイルを削除しました" -ForegroundColor Green
    } catch {
        Write-Host "⚠ ロックファイルの削除に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
    }
}

if ($processesToKill.Count -eq 0) {
    Write-Host "実行中のNext.jsプロセスが見つかりませんでした" -ForegroundColor Green
} else {
    Write-Host "以下のプロセスを終了します:" -ForegroundColor Yellow
    foreach ($proc in $processesToKill) {
        Write-Host "  - PID: $($proc.Id), プロセス名: $($proc.ProcessName), コマンドライン: $($proc.Path)" -ForegroundColor Cyan
    }
    
    $confirm = Read-Host "終了しますか? (Y/N)"
    if ($confirm -eq "Y" -or $confirm -eq "y") {
        foreach ($proc in $processesToKill) {
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                Write-Host "✓ プロセス $($proc.Id) を終了しました" -ForegroundColor Green
            } catch {
                Write-Host "✗ プロセス $($proc.Id) の終了に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        Write-Host "`n完了しました。再度 'npm run dev' を実行してください。" -ForegroundColor Green
    } else {
        Write-Host "キャンセルしました" -ForegroundColor Yellow
    }
}
