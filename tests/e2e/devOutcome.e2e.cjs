/**
 * Dev-only WIN/LOSS/DRAW control (dev server) + its absence from the
 * production build, plus the contrast tokens used by feed timestamps and
 * opponent sub-points. Run through `npm run test:e2e`.
 */
const { chromium } = require('playwright-core');
const { chromePath, PROD_URL, DEV_URL, SHOTS } = require('./config.cjs');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const check = (n, ok, d = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${ok ? '' : d}`); };

async function session(browser, base) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const btn = (name) => page.getByRole('button', { name, exact: false }).first();
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Student Email Address').fill('dev.outcome@kiit.ac.in');
  await btn('Continue with Email').click();
  await page.getByText('Verification Code').first().waitFor({ timeout: 20000 });
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill('123456'[i]);
  await btn('Verify Code').click();
  await btn('Enter KIITDual').click();
  const startMatch = async () => {
    await btn(/Find a Focus Partner|Find Another Focus Partner/).click();
    await btn('Start Matching').click();
    await page.getByText('Focus Partner Found').waitFor({ timeout: 8000 });
    await btn('Start Match Now').click();
    await page.getByText('Pomodoro Focus Engine').waitFor();
  };
  return { page, errors, btn, startMatch };
}

(async () => {
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true });

  // ---------- DEV server ----------
  const dev = await session(browser, DEV_URL);
  await dev.startMatch();
  const select = dev.page.getByLabel('Demo outcome at match end:');
  check('dev: DEV ONLY control visible in workspace', await select.isVisible());
  await dev.page.locator('text=DEV ONLY').first().screenshot({ path: path.join(SHOTS, 'dev-control.png') }).catch(() => {});
  await dev.page.locator('text=DEV ONLY').first().evaluate((el) => el.parentElement.scrollIntoView());
  await dev.page.screenshot({ path: path.join(SHOTS, 'dev-workspace.png') });

  const ts = dev.page.getByRole('log', { name: 'Opponent activity' }).locator('span.text-\\[\\#8A96AB\\]').first();
  check('activity timestamp uses #8A96AB', (await ts.evaluate((el) => getComputedStyle(el).color)) === 'rgb(138, 150, 171)');

  for (const [value, verdict] of [['win', 'MATCH VICTORY'], ['draw', 'DEAD HEAT DRAW'], ['loss', 'MATCH COMPLETE']]) {
    await dev.page.getByLabel('Demo outcome at match end:').selectOption(value);
    await dev.page.getByRole('checkbox', { name: /Review lecture notes/ }).click(); // 30 pts
    await dev.btn('Demo: fast-forward match expiry').click();
    await sleep(2600);
    const text = await dev.page.locator('body').innerText();
    check(`dev: Force ${value.toUpperCase()} -> ${verdict}`, text.includes(verdict));
    if (value === 'win') {
      const sub = dev.page.locator('span.text-\\[\\#8A96AB\\]', { hasText: 'pts' }).first();
      check('scorecard opponent sub-points use #8A96AB', (await sub.evaluate((el) => getComputedStyle(el).color)) === 'rgb(138, 150, 171)');
      await dev.page.reload();
      await sleep(2600);
      check('dev: forced WIN scorecard stable after refresh', (await dev.page.locator('body').innerText()).includes('MATCH VICTORY'));
    }
    if (value !== 'loss') await dev.startMatch();
  }
  check('dev: no page errors', dev.errors.length === 0, dev.errors.join('|'));

  // ---------- PRODUCTION preview ----------
  const prod = await session(browser, PROD_URL);
  await prod.startMatch();
  check('prod: DEV ONLY control absent', (await prod.page.locator('text=DEV ONLY').count()) === 0);
  // Even with a stale dev setting in storage, production uses the natural opponent.
  await prod.page.evaluate(() => localStorage.setItem('focusmatch_dev_demo_outcome', '"win"'));
  await prod.btn('Demo: fast-forward match expiry').click();
  await sleep(2600);
  const uid = await prod.page.evaluate(() => JSON.parse(localStorage.getItem('focusmatch_user')).id);
  const hist = await prod.page.evaluate((u) => JSON.parse(localStorage.getItem(`focusmatch_u_${u}_match_history`)), uid);
  check('prod: stale dev setting ignored (natural opponent >= 105 pts)', hist[0].opponentResult.finalScore >= 105);
  check('prod: no page errors', prod.errors.length === 0, prod.errors.join('|'));

  console.log(`\n${passed} passed, ${failed} failed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
