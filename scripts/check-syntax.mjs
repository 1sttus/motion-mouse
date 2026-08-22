import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

async function files(dir) { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map((e) => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))).flat(); }
const filesToCheck = [...(await files('packages')), ...(await files('apps'))].filter((file) => file.endsWith('.js'));
await Promise.all(filesToCheck.map((file) => new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--check', file]); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`syntax failed: ${file}`))); })));
console.log(`syntax passed for ${filesToCheck.length} JavaScript files`);
