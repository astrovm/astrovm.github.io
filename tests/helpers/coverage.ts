// VM scripts need counters in their own context. Share those counters across pages.
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { createInstrumenter } from 'istanbul-lib-instrument';
import { createCoverageMap } from 'istanbul-lib-coverage';
import { createContext } from 'istanbul-lib-report';
import reports from 'istanbul-reports';

export const coverage = {};
const root = fileURLToPath(new URL('../../', import.meta.url));
const instrumenter = createInstrumenter({ compact: false, coverageGlobalScope: 'globalThis', coverageGlobalScopeFunc: false });
const sources = new Map<string, string>();
const baseline = createCoverageMap({});
// Include files even when no test loads them. Third-party Genesis and the Hugo theme
// are vendored code; utils and move.js are measured by Bun's existing coverage gate.
for (const path of [...new Bun.Glob('assets/**/*.js').scanSync({ cwd: root }), 'workers/ghosts/src/index.js']) {
  const filename = resolve(root, path);
  sources.set(path, instrumenter.instrumentSync(readFileSync(filename, 'utf8'), filename));
  baseline.addFileCoverage(instrumenter.lastFileCoverage());
}
export function browserSource(path: string) {
  const source = sources.get(path);
  if (!source) throw new Error(`No coverage source for ${path}`);
  return source;
}

export function reportCoverage() {
  baseline.merge(coverage);
  mkdirSync(resolve(root, 'coverage/web'), { recursive: true });
  const context = createContext({ dir: resolve(root, 'coverage/web'), coverageMap: baseline });
  for (const name of ['text', 'html', 'lcovonly', 'json', 'json-summary'] as const) reports.create(name, name === 'text' ? { maxCols: 120 } : {}).execute(context);
  let failed = false;
  for (const file of baseline.files()) {
    const summary = baseline.fileCoverageFor(file).toSummary();
    for (const metric of ['lines', 'functions'] as const) {
      const { covered, total } = summary[metric];
      if (covered !== total) {
        console.error(`${relative(root, file)}: ${metric} ${covered}/${total}; requires 100%`);
        failed = true;
      }
    }
  }
  if (failed) throw new Error("Web coverage must reach 100% lines and functions in every file");
}
