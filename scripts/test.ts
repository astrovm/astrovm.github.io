import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const child = Bun.spawn([
  'bun', 'test', '--coverage', '--coverage-reporter=text', '--coverage-reporter=lcov',
  '--coverage-dir=coverage/bun', '--preload', './tests/helpers/coverage-preload.ts',
], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
const code = await child.exited;
if (code !== 0) process.exit(code);

// Bun only reports imported files. Also reject production sources absent from both
// reports, so adding an untested helper cannot preserve a misleading 100% total.
const web = JSON.parse(readFileSync(resolve(root, 'coverage/web/coverage-final.json'), 'utf8'));
const measured = new Set(Object.keys(web));
for (const match of readFileSync(resolve(root, 'coverage/bun/lcov.info'), 'utf8').matchAll(/^SF:(.+)$/gm)) {
  measured.add(resolve(root, match[1]));
}
for (const pattern of ['assets/**/*.js', 'utils/**/*.ts', 'workers/ghosts/src/**/*.js']) {
  for (const path of new Bun.Glob(pattern).scanSync({ cwd: root })) {
    if (path.endsWith('.test.ts') || path.endsWith('.test.js')) continue;
    if (!measured.has(resolve(root, path))) {
      console.error(`${path}: absent from coverage; requires tests`);
      process.exitCode = 1;
    }
  }
}
