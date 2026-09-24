/**
 * Browser regression runner: `npm run test:e2e`
 *
 * 1. Builds the production bundle.
 * 2. Starts `vite preview` (production, :4173) and `vite` (dev, :5174).
 * 3. Runs tests/e2e/*.e2e.cjs in headless Chrome via playwright-core
 *    (uses a locally installed browser; set CHROME_PATH if not auto-detected).
 * 4. Always stops both servers.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const e2eDir = join(root, 'tests', 'e2e');
const PROD_PORT = 4173;
const DEV_PORT = 5174;

const step = (msg) => console.log(`\n>>> ${msg}`);

step('Building production bundle');
const buildRun = spawnSync(process.execPath, [vite, 'build'], { cwd: root, stdio: 'inherit' });
if (buildRun.status !== 0) process.exit(buildRun.status ?? 1);

const servers = [
  spawn(process.execPath, [vite, 'preview', '--port', String(PROD_PORT), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  }),
  spawn(process.execPath, [vite, '--port', String(DEV_PORT), '--strictPort', '--open', 'false'], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, BROWSER: 'none' },
  }),
];
const stopServers = () => servers.forEach((s) => s.kill());
process.on('exit', stopServers);
process.on('SIGINT', () => process.exit(130));

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not start: ${url}`);
}

let failed = 0;
try {
  step('Starting preview + dev servers');
  await waitFor(`http://localhost:${PROD_PORT}/`);
  await waitFor(`http://localhost:${DEV_PORT}/`);

  const suites = readdirSync(e2eDir).filter((f) => f.endsWith('.e2e.cjs')).sort();
  for (const suite of suites) {
    step(`Running ${suite}`);
    const run = spawnSync(process.execPath, [join(e2eDir, suite)], {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_PROD_URL: `http://localhost:${PROD_PORT}/`,
        E2E_DEV_URL: `http://localhost:${DEV_PORT}/`,
      },
    });
    if (run.status !== 0) failed++;
  }
  console.log(`\n${suites.length - failed}/${suites.length} browser suites passed`);
} finally {
  stopServers();
}
process.exit(failed ? 1 : 0);
