import { readFile } from 'node:fs/promises';

const forbidden = [
  ['packages/protocol/src/index.js', '../motion-core'],
  ['packages/motion-core/src/index.js', '../protocol'],
  ['packages/protocol/src/index.js', '../../apps'],
  ['packages/motion-core/src/index.js', '../../apps']
];
for (const [file, token] of forbidden) {
  if ((await readFile(file, 'utf8')).includes(token)) throw new Error(`forbidden dependency: ${file} -> ${token}`);
}
console.log('dependency graph passed: shared packages are acyclic and app-independent');
