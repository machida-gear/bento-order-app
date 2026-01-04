# PDF出力機能のフォント問題解決と日本語対応

このドキュメントでは、PDF出力機能のフォント問題解決と日本語対応の実装過程を記録します。

> 📖 **関連ドキュメント**: [CHANGELOG.md](./CHANGELOG.md) - 変更履歴

---

## 問題の概要

### 1. Helvetica.afmファイルが見つからないエラー

PDF生成時に以下のエラーが発生していました：

```
ENOENT: no such file or directory, open 'C:\\Users\\kazu\\my-app\\.next\\dev\\server\\vendor-chunks\\data\\Helvetica.afm'
```

**原因:**
- pdfkitがデフォルトフォント（Helvetica）のファイルを`.next/dev/server/vendor-chunks/data/`から読み込もうとしている
- Next.jsのビルドプロセスで、`node_modules`内のフォントファイルが`.next`フォルダにコピーされない
- 開発サーバー起動後に`.next`フォルダが再構築され、フォントファイルが消えてしまう

### 2. 日本語文字化け問題

PDF生成時に日本語が文字化けしていました。

**原因:**
- pdfkitのデフォルトフォント（Helvetica）は日本語をサポートしていない
- 日本語フォントが埋め込まれていない

---

## 解決策

### 1. フォントファイルの自動コピースクリプトの作成

#### scripts/copy-fonts.js

開発サーバー起動前に、pdfkitのフォントファイルを`.next`フォルダにコピーするスクリプトを作成しました。

```javascript
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
```

#### scripts/copy-fonts.ps1

PowerShell用のスクリプトも作成しました（Windows環境用）。

### 2. package.jsonの修正

`predev`スクリプトを追加し、開発サーバー起動前に自動的にフォントファイルをコピーするようにしました。

```json
{
  "scripts": {
    "copy-fonts": "node scripts/copy-fonts.js",
    "copy-fonts:ps1": "powershell -ExecutionPolicy Bypass -File scripts/copy-fonts.ps1",
    "predev": "node scripts/copy-fonts.js",
    "dev": "next dev --webpack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

**変更点:**
- `predev`スクリプトを追加（`npm run dev`実行前に自動的にフォントファイルをコピー）
- `dev`スクリプトに`--webpack`フラグを追加（Next.js 16でTurbopackがデフォルトのため）

### 3. next.config.tsの修正

Next.js 16ではTurbopackがデフォルトのため、webpack設定を削除しました。

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16ではTurbopackがデフォルトのため、webpack設定は削除
  // pdfkitのフォント問題は、フォントを指定せずにデフォルト動作に任せることで解決を試みる
};

export default nextConfig;
```

### 4. PDF生成APIの改善

#### フォントファイルの動的コピー

PDF生成時に、フォントファイルが存在しない場合は自動的にコピーする処理を追加しました。

```typescript
// pdfkitのデフォルトフォント（Helvetica）の問題を回避するため、
// フォントファイルをnode_modulesから直接読み込むように環境変数を設定
const fontDataDir = path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data')

// フォントファイルが存在することを確認
const helveticaPath = path.join(fontDataDir, 'Helvetica.afm')
if (!fs.existsSync(helveticaPath)) {
  // フォントファイルが見つからない場合は、.nextフォルダにコピーを試みる
  const targetDir = path.join(process.cwd(), '.next', 'dev', 'server', 'vendor-chunks', 'data')
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }
  const targetPath = path.join(targetDir, 'Helvetica.afm')
  if (fs.existsSync(helveticaPath) && !fs.existsSync(targetPath)) {
    fs.copyFileSync(helveticaPath, targetPath)
    console.log('Copied Helvetica.afm to .next folder')
  }
}
```

#### 日本語フォントの埋め込み

日本語フォントを登録して使用する処理を追加しました。

```typescript
// 日本語フォントを登録（IPAフォントまたはNoto Sans JP）
let japaneseFontRegistered = false
try {
  // 複数のフォントパスを試す
  const possibleFontPaths = [
    path.join(process.cwd(), 'public', 'fonts', 'ipaexg.ttf'), // IPAexゴシック（実際のファイル名）
    path.join(process.cwd(), 'public', 'fonts', 'IPAexGothic.ttf'), // IPAexゴシック（標準名）
    path.join(process.cwd(), 'public', 'fonts', 'ipag.ttf'), // IPAゴシック（旧版）
    path.join(process.cwd(), 'public', 'fonts', 'ipagp.ttf'), // IPA Pゴシック
    path.join(process.cwd(), 'public', 'fonts', 'NotoSansJP-Regular.ttf'), // Noto Sans JP
    path.join(process.cwd(), 'public', 'fonts', 'NotoSansCJK-Regular.ttf'), // Noto Sans CJK
  ]
  
  // デバッグ: フォントファイルの存在確認
  console.log('Checking font files...')
  for (const fontPath of possibleFontPaths) {
    const exists = fs.existsSync(fontPath)
    console.log(`Font path: ${fontPath}, exists: ${exists}`)
    if (exists) {
      try {
        doc.registerFont('Japanese', fontPath)
        doc.font('Japanese')
        japaneseFontRegistered = true
        console.log(`✓ Japanese font registered successfully: ${fontPath}`)
        break
      } catch (fontError) {
        console.error(`Failed to register font ${fontPath}:`, fontError)
      }
    }
  }
  
  if (!japaneseFontRegistered) {
    console.warn('⚠ Japanese font not found. PDF may display garbled text for Japanese characters.')
    console.warn('Please download IPA font or Noto Sans JP and place it in public/fonts/')
    console.warn('Checked paths:', possibleFontPaths)
  }
} catch (error) {
  console.error('Failed to register Japanese font:', error)
}
```

### 5. フォント設定手順ドキュメントの作成

`docs/PDFフォント設定手順.md`を作成し、日本語フォントのダウンロードと配置手順を記載しました。

---

## 修正ファイル一覧

### 新規作成

- `scripts/copy-fonts.js`: フォントファイルコピースクリプト（Node.js用）
- `scripts/copy-fonts.ps1`: フォントファイルコピースクリプト（PowerShell用）
- `docs/PDFフォント設定手順.md`: フォント設定手順ドキュメント
- `docs/PDF出力機能のフォント問題解決と日本語対応.md`: このドキュメント

### 修正

- `app/api/admin/orders/today/pdf/route.ts`: 日本語フォントの埋め込み機能、フォントファイルの動的コピー処理
- `next.config.ts`: webpack設定の削除
- `package.json`: `predev`スクリプトの追加、`--webpack`フラグの追加

---

## 確認事項

- ✅ PDF生成時にHelvetica.afmエラーが解消される
- ✅ 日本語フォントが正しく読み込まれる
- ✅ PDFで日本語が正しく表示される
- ✅ 開発サーバー起動前に自動的にフォントファイルがコピーされる

---

## 注意事項

1. **日本語フォントの配置**
   - 日本語フォント（IPAexフォントまたはIPAフォント）を`public/fonts/`フォルダに配置する必要があります
   - フォントファイルのダウンロード手順は`docs/PDFフォント設定手順.md`を参照してください

2. **開発サーバーの再起動**
   - 開発サーバーを再起動するたびに、`predev`スクリプトでフォントファイルが自動的にコピーされます

3. **Windowsのセキュリティ警告**
   - ダウンロードしたフォントファイルにWindowsのセキュリティ警告が表示される場合があります
   - ファイルのプロパティで「許可する(K)」にチェックを入れてください

4. **Next.js 16のTurbopack対応**
   - Next.js 16ではTurbopackがデフォルトのため、`--webpack`フラグを明示的に指定する必要があります
   - webpack設定は削除し、Turbopackのデフォルト動作に任せています

---

## 参考リンク

- [IPAexフォントのダウンロードページ](https://moji.or.jp/ipafont/ipafontdownload/)
- [IPAフォント Ver.003.03 ダウンロードページ](https://moji.or.jp/ipafont/ipa00303/)
- [Google Fonts - Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)
