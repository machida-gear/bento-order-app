// Next.js開発サーバーのプロセスを終了するスクリプト（Node.js版）
// ポート3000または3001を使用しているNext.jsプロセスを終了

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Next.js開発サーバーのプロセスを検索中...');

// ロックファイルを削除
const lockFile = path.join(__dirname, '..', '.next', 'dev', 'lock');
if (fs.existsSync(lockFile)) {
  console.log(`ロックファイルが見つかりました: ${lockFile}`);
  try {
    fs.unlinkSync(lockFile);
    console.log('✓ ロックファイルを削除しました');
  } catch (error) {
    console.warn(`⚠ ロックファイルの削除に失敗しました: ${error.message}`);
  }
}

// Windowsの場合、netstatとtaskkillを使用
if (process.platform === 'win32') {
  try {
    // ポート3000と3001を使用しているプロセスを検索
    const ports = [3000, 3001];
    const pids = new Set();
    
    for (const port of ports) {
      try {
        const netstatOutput = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        const lines = netstatOutput.split('\n');
        for (const line of lines) {
          const match = line.match(/\s+(\d+)\s*$/);
          if (match) {
            pids.add(match[1]);
          }
        }
      } catch (error) {
        // ポートを使用しているプロセスが見つからない場合は無視
      }
    }
    
    if (pids.size === 0) {
      console.log('実行中のNext.jsプロセスが見つかりませんでした');
      console.log('再度 \'npm run dev\' を実行してください。');
      return;
    }
    
    console.log('以下のプロセスを終了します:');
    for (const pid of pids) {
      try {
        const tasklistOutput = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV`, { encoding: 'utf-8' });
        console.log(`  - PID: ${pid}`);
      } catch (error) {
        // プロセス情報の取得に失敗した場合は無視
      }
    }
    
    // プロセスを終了
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`✓ プロセス ${pid} を終了しました`);
      } catch (error) {
        console.warn(`⚠ プロセス ${pid} の終了に失敗しました: ${error.message}`);
      }
    }
    
    console.log('\n完了しました。再度 \'npm run dev\' を実行してください。');
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    console.log('\n手動でプロセスを終了する方法:');
    console.log('1. タスクマネージャーを開く');
    console.log('2. 「詳細」タブを選択');
    console.log('3. 「node.exe」または「next」プロセスを探す');
    console.log('4. プロセスを右クリックして「タスクの終了」を選択');
  }
} else {
  console.log('このスクリプトはWindows環境でのみ動作します。');
  console.log('Linux/Macの場合は、以下のコマンドを実行してください:');
  console.log('  lsof -ti:3000 | xargs kill -9');
  console.log('  lsof -ti:3001 | xargs kill -9');
}
