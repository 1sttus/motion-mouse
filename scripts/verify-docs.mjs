import { access, readFile } from 'node:fs/promises';

const docs = ['PROJECT_CONTEXT.md', 'ARCHITECTURE.md', 'SYSTEM_GRAPH.md', 'PROTOCOL.md', 'MOTION_ENGINE.md', 'PLATFORM_MATRIX.md', 'SECURITY_MODEL.md', 'DECISIONS.md', 'TESTING_STRATEGY.md', 'ROADMAP.md'];
for (const doc of docs) await access(doc);
const architecture = await readFile('ARCHITECTURE.md', 'utf8');
for (const module of ['apps/mobile', 'apps/desktop-agent', 'packages/motion-core', 'packages/shared-models', 'packages/protocol']) {
  if (!architecture.includes(module)) throw new Error(`ARCHITECTURE.md does not reference ${module}`);
}
console.log(`documentation passed: ${docs.length} governing documents and module references found`);
