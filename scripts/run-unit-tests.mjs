/**
 * Unit test runner: `npm test`
 *
 * Bundles each tests/unit/*.test.ts with esbuild and runs it in Node.
 * Files named *.dev.test.ts are built as a development bundle
 * (import.meta.env.DEV = true); all others as a production bundle (false),
 * mirroring how Vite treats the app.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const testDir = join(root, 'tests', 'unit');
const outDir = mkdtempSync(join(tmpdir(), 'kiitdual-tests-'));
const files = readdirSync(testDir).filter((f) => f.endsWith('.test.ts')).sort();

let failedSuites = 0;
try {
  for (const file of files) {
    const isDev = file.endsWith('.dev.test.ts');
    const outfile = join(outDir, file.replace(/\.ts$/, '.cjs'));
    await build({
      entryPoints: [join(testDir, file)],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      logLevel: 'error',
      define: { 'import.meta.env.DEV': String(isDev) },
    });
    console.log(`\n=== ${file} (${isDev ? 'DEV' : 'PRODUCTION'} build) ===`);
    // Suites log expected storage warnings on stderr; show only the results.
    const run = spawnSync(process.execPath, [outfile], { encoding: 'utf8' });
    process.stdout.write(run.stdout);
    if (run.status !== 0) {
      failedSuites++;
      process.stdout.write(run.stderr);
    }
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log(`\n${files.length - failedSuites}/${files.length} suites passed`);
process.exit(failedSuites ? 1 : 0);
