# pdfkitのフォントファイルを.nextフォルダにコピー
$sourceDir = Join-Path $PSScriptRoot "..\node_modules\pdfkit\js\data"
$targetDir = Join-Path $PSScriptRoot "..\.next\dev\server\vendor-chunks\data"

# ターゲットディレクトリを作成
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# フォントファイルをコピー
try {
    $files = Get-ChildItem -Path $sourceDir -Filter "*.afm"
    foreach ($file in $files) {
        $sourcePath = Join-Path $sourceDir $file.Name
        $targetPath = Join-Path $targetDir $file.Name
        Copy-Item -Path $sourcePath -Destination $targetPath -Force
        Write-Host "Copied $($file.Name) to .next/dev/server/vendor-chunks/data/"
    }
} catch {
    Write-Warning "Failed to copy font files: $($_.Exception.Message)"
}
