// Pre-dev script: kill existing Next.js processes and copy fonts
const { execSync } = require('child_process');
const path = require('path');

// Kill Next.js processes (non-interactive)
// Use simple execSync with short timeout and error handling
try {
  const scriptPath = path.join(__dirname, 'kill-nextjs-quiet.ps1');
  // Use -Command instead of -File to avoid potential hanging issues
  const command = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference='SilentlyContinue'; & '${scriptPath.replace(/\\/g, '/')}' }"`;
  execSync(command, { 
    stdio: 'ignore',
    windowsHide: true,
    timeout: 2000
  });
} catch (error) {
  // Ignore errors (timeout or process not found is okay)
}

// Copy fonts
require('./copy-fonts.js');
