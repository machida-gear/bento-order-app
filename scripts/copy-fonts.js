const fs = require('fs');
const path = require('path');

// pdfkitのフォントファイルを.nextフォルダにコピー
const sourceDir = path.join(__dirname, '..', 'node_modules', 'pdfkit', 'js', 'data');
const targetDir = path.join(__dirname, '..', '.next', 'dev', 'server', 'vendor-chunks', 'data');

// ターゲットディレクトリを作成
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// フォントファイルをコピー
try {
  const files = fs.readdirSync(sourceDir);
  files.forEach(file => {
    if (file.endsWith('.afm')) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied ${file} to .next/dev/server/vendor-chunks/data/`);
    }
  });
} catch (error) {
  console.warn('Failed to copy font files:', error.message);
}
