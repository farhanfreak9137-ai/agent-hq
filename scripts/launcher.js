import { spawn, exec } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('🚀 AGENT HQ — ONE-CLICK APPLICATION LAUNCHER');
console.log('====================================================');

function checkHttp(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(name, url, maxWaitMs = 25000) {
  const start = Date.now();
  process.stdout.write(`⏳ Waiting for ${name} (${url})...`);
  while (Date.now() - start < maxWaitMs) {
    const ok = await checkHttp(url);
    if (ok) {
      console.log(`\n✅ ${name} is ready!`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
    process.stdout.write('.');
  }
  console.log(`\n⚠️ ${name} did not respond within ${maxWaitMs / 1000}s, proceeding...`);
  return false;
}

// Start Backend Server
console.log('\n[1/3] Starting Agent HQ Backend Server (Port 3001)...');
const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const backendProcess = spawn(npxCmd, ['tsx', 'watch', 'server/index.ts'], {
  cwd: rootDir,
  shell: isWin,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3001' },
});

// Start Frontend Dev Server
console.log('[2/3] Starting Agent HQ Frontend Vite UI (Port 3005)...');
const frontendProcess = spawn(npxCmd, ['vite', '--port=3005', '--host=0.0.0.0'], {
  cwd: rootDir,
  shell: isWin,
  stdio: 'inherit',
});

function cleanup() {
  console.log('\n🛑 Shutting down Agent HQ services...');
  try {
    if (backendProcess && !backendProcess.killed) {
      if (isWin) {
        exec(`taskkill /pid ${backendProcess.pid} /T /F`);
      } else {
        backendProcess.kill();
      }
    }
    if (frontendProcess && !frontendProcess.killed) {
      if (isWin) {
        exec(`taskkill /pid ${frontendProcess.pid} /T /F`);
      } else {
        frontendProcess.kill();
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

async function main() {
  // Wait for both services to be responsive
  await waitForServer('Backend API', 'http://127.0.0.1:3001/api/health');
  await waitForServer('Frontend UI', 'http://127.0.0.1:3005');

  console.log('\n====================================================');
  console.log('🎉 Agent HQ is LIVE!');
  console.log('   Web UI:     http://localhost:3005');
  console.log('   API & DB:   http://127.0.0.1:3001');
  console.log('====================================================');
  console.log('[3/3] Opening Agent HQ in your default browser...\n');

  if (isWin) {
    exec('start http://localhost:3005');
  } else if (process.platform === 'darwin') {
    exec('open http://localhost:3005');
  } else {
    exec('xdg-open http://localhost:3005');
  }

  console.log('💡 Keep this window open while using Agent HQ. Press Ctrl+C to stop.');
}

main().catch(console.error);
