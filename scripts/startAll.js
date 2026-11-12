import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const serverDir = path.resolve(rootDir, 'server');
const cloudflaredBin = path.resolve(process.env.HOME, '.bin/cloudflared');

console.log('\n📦 Starting Deadstock Marketplace Full Stack...\n');

const children = [];

function killAll() {
  console.log('\n🛑 Stopping all services...');
  for (const child of children) {
    try {
      child.kill('SIGINT');
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1. Start MongoDB
console.log('1️⃣  Starting local MongoDB...');
const mongoProc = spawn('node', ['scripts/localDb.js'], {
  cwd: serverDir,
  stdio: ['ignore', 'pipe', 'inherit']
});
children.push(mongoProc);

let mongoReady = false;
mongoProc.stdout.on('data', (d) => {
  const text = d.toString();
  if (text.includes('Local MongoDB is running')) {
    mongoReady = true;
  }
});

for (let i = 0; i < 30; i++) {
  if (mongoReady) break;
  await sleep(200);
}
console.log('   ✅ MongoDB ready');

// 2. Start Backend API
console.log('2️⃣  Starting Express Backend API...');
const apiProc = spawn('node', ['src/server.js'], {
  cwd: serverDir,
  stdio: ['ignore', 'pipe', 'inherit']
});
children.push(apiProc);

let apiReady = false;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch('http://127.0.0.1:4000/api/health');
    const data = await res.json();
    if (data.ok) {
      apiReady = true;
      break;
    }
  } catch {}
  await sleep(300);
}
if (!apiReady) {
  console.error('❌ Backend failed to start');
  killAll();
}
console.log('   ✅ Backend ready on http://localhost:4000');

// 3. Start Vite
console.log('3️⃣  Starting Vite Web Frontend...');
const viteProc = spawn('npx', ['vite'], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'inherit']
});
children.push(viteProc);

let viteReady = false;
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch('http://127.0.0.1:5173/');
    if (res.status === 200) {
      viteReady = true;
      break;
    }
  } catch {}
  await sleep(300);
}
console.log('   ✅ Vite ready on http://localhost:5173');

// 4. Start Cloudflare Tunnel
console.log('4️⃣  Establishing Cloudflare Tunnel...');
const cfProc = spawn(cloudflaredBin, ['tunnel', '--url', 'http://localhost:5173'], {
  stdio: ['ignore', 'pipe', 'pipe']
});
children.push(cfProc);

let publicUrl = '';
const onLog = (chunk) => {
  const text = chunk.toString();
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !publicUrl) {
    publicUrl = match[0];
    console.log('\n' + '='.repeat(68));
    console.log('🎉 DEADSTOCK MARKETPLACE IS LIVE & PUBLICLY ACCESSIBLE!');
    console.log('='.repeat(68));
    console.log(`🌐 Public URL:   ${publicUrl}`);
    console.log(`💻 Local URL:    http://localhost:5173`);
    console.log(`🔑 Admin Login:  tmtanmay11@gmail.com / password123`);
    console.log('='.repeat(68));
    console.log('\n(Press Ctrl+C to stop all services at any time)\n');
  }
};

cfProc.stdout.on('data', onLog);
cfProc.stderr.on('data', onLog);

