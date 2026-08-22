import shell from 'shelljs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('--- Starting Windows Build for Motion Mouse Agent ---');

// 1. Clean dist directory
if (shell.test('-d', distDir)) {
  shell.rm('-rf', distDir);
}
shell.mkdir('-p', distDir);

// 2. Run pkg
console.log('Running pkg...');
try {
  // We use npx to run pkg from node_modules
  // We specify the entry point index.js
  // We output to dist/motion-mouse-agent.exe
  execSync('npx pkg . --output dist/motion-mouse-agent.exe', {
    cwd: rootDir,
    stdio: 'inherit'
  });
} catch (err) {
  console.error('pkg failed:', err);
  process.exit(1);
}

// 3. Post-build: Ensure assets are handled
// systray2 binaries are bundled into the exe by pkg as assets.
// However, systray2 might expect them on disk.
// If it fails at runtime, we might need to extract them or copy them alongside.
// For now, we assume pkg's snapshot works.

console.log('Build complete! Check apps/desktop-agent/dist/motion-mouse-agent.exe');
