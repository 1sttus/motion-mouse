import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
}

const sourceFiles = (await files('packages')).filter((file) => file.endsWith('.js'));
const violations = [];
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  if (source.includes('\t')) violations.push(`${file}: tabs are not permitted`);
  if (source.split('\n').some((line) => /\s+$/.test(line))) violations.push(`${file}: trailing whitespace`);
}
if (violations.length) throw new Error(violations.join('\n'));
console.log(`lint passed for ${sourceFiles.length} JavaScript files`);
