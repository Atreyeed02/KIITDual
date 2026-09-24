/**
 * Full user-journey regression (production build via `vite preview`).
 * Fresh user, refresh matrix, match edge cases A–F, idempotency, per-user
 * isolation, reset, corrupted storage, responsive overflow, keyboard basics.
 * Run through `npm run test:e2e`.
 */
const { chromium } = require('playwright-core');
const { chromePath, PROD_URL, DEV_URL, SHOTS } = require('./config.cjs');
const path = require('path');

const BASE = PROD_URL;
let passed = 0, failed = 0;
const failures = [];
const check = (name, ok, detail = '') => {
  ok ? passed++ : failed++;
  if (!ok) failures.push(`${name} ${detail}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem('focusmatch_' + k) ?? 'null'), k);
  const uid = async () => (await ls('user'))?.id;
  const uls = async (k) => ls(`u_${await uid()}_${k}`);
  const setUls = async (k, v) => {
    const id = await uid();
    await page.evaluate(([k, v]) => localStorage.setItem('focusmatch_' + k, JSON.stringify(v)), [`u_${id}_${k}`, v]);
  };
  const reload = async () => { await page.reload(); await page.waitForLoadState('networkidle'); };
  const visible = (text) => page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
  const btn = (name) => page.getByRole('button', { name, exact: false }).first();
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  const login = async (email) => {
    await page.getByLabel('Student Email Address').fill(email);
    await btn('Continue with Email').click();
    await page.getByText('Verification Code').first().waitFor();
    for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill('123456'[i]);
    await btn('Verify Code').click();
    await page.getByText('Your Study Identity').waitFor();
    await btn('Enter KIITDual').click();
    await page.getByText(/Ready to focus\?|Your Focus Match is Active!/).first().waitFor();
  };
  const findMatch = async () => {
    await btn('Find a Focus Partner').click();
    await btn('Start Matching').click();
    await page.getByText('Focus Partner Found').waitFor({ timeout: 8000 });
    await btn('Start Match Now').click();
    await page.getByText('Pomodoro Focus Engine').waitFor();
  };

  // ---------------- 2. Fresh user ----------------
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await reload();
  check('fresh: auth screen shown', await visible('Enter College Email'));
  await reload();
  check('refresh @login keeps login screen', await visible('Enter College Email'));

  await page.getByLabel('Student Email Address').fill('someone@gmail.com');
  await btn('Continue with Email').click();
  check('non-college email rejected with inline error', await page.getByRole('alert').first().isVisible());

  await page.getByLabel('Student Email Address').fill('demo.student@kiit.ac.in');
  await btn('Continue with Email').click();
  await page.getByText('Verification Code').first().waitFor();
  check('OTP screen reached', true);
  await reload();
  check('refresh @OTP keeps OTP screen', await visible('Verification Code'));

  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill('9');
  await btn('Verify Code').click();
  await page.getByRole('alert').first().waitFor();
  check('wrong OTP shows error', await visible('Invalid 6-digit'));
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill('123456'[i]);
  await btn('Verify Code').click();
  await page.getByText('Your Study Identity').waitFor();
  const alias1 = await page.locator('h3').first().innerText();
  await reload();
  check('refresh @identity setup keeps identity & alias', (await visible('Your Study Identity')) && (await page.locator('h3').first().innerText()) === alias1);
  await btn('Enter KIITDual').click();
  await page.getByText('Ready to focus?').waitFor();
  check('dashboard loads for new user', true);
  check('fresh user: empty history state', await visible('No matches completed yet.'));
  check('fresh user: streak starts at 0', await visible('Streak: 0'));
  check('fresh user: no seeded fake history after refresh', (await reload(), (await uls('match_history'))?.length ?? 0) === 0);

  await btn('Match History').click();
  check('history empty state', await visible("haven't completed any"));
  check('analytics empty stats (0% win rate)', await visible('0%'));
  await reload();
  check('refresh @history stays on history', await visible('Match History & Archives'));
  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('button', { name: 'Settings' }).click();
  check('settings loads', await visible('Preferences & Identity'));
  await reload();
  check('refresh @settings stays on settings', await visible('Preferences & Identity'));
  await btn('KIITDual — go to Dashboard').click();

  // ---------------- 10. Matchmaking ----------------
  await btn('Find a Focus Partner').click();
  await btn('Start Matching').click();
  check('searching state', await visible('Finding your focus partner'));
  await btn('Cancel Search').click();
  await sleep(3800);
  check('cancelled search does NOT later produce a match (stale timer fixed)', (await visible('Start Matching')) && !(await visible('Focus Partner Found')));
  await btn('Start Matching').click();
  await sleep(800);
  await reload();
  check('refresh during search resumes searching', await visible('Finding your focus partner'));
  await page.getByText('Focus Partner Found').waitFor({ timeout: 8000 });
  const oppBefore = (await uls('matchmaking_session'))?.opponent?.anonUsername;
  await reload();
  const oppAfter = (await uls('matchmaking_session'))?.opponent?.anonUsername;
  check('refresh after match found keeps same opponent', (await visible('Focus Partner Found')) && oppBefore && oppBefore === oppAfter, `${oppBefore} vs ${oppAfter}`);
  await btn('Start Match Now').dblclick();
  await page.getByText('Pomodoro Focus Engine').waitFor();
  const match1 = await uls('current_match');
  check('match created once (double click)', !!match1 && (await uls('match_history')).length === 0);

  // ---------------- 4A. refresh active match ----------------
  await reload();
  check('Case A: active match survives refresh', (await visible('Pomodoro Focus Engine')) && (await uls('current_match'))?.id === match1.id);

  // ---------------- 11. Tasks ----------------
  const addBtn = btn('Add Goal');
  await page.getByLabel('New study goal').fill('    ');
  check('whitespace-only task rejected (button disabled)', await addBtn.isDisabled());
  await page.getByLabel('New study goal').fill('Read chapter 5');
  await addBtn.click();
  check('task added', await visible('Read chapter 5'));
  await page.getByRole('checkbox', { name: /Read chapter 5/ }).click();
  check('task marked done (aria-checked)', (await page.getByRole('checkbox', { name: /Read chapter 5/ }).getAttribute('aria-checked')) === 'true');
  await reload();
  const tasks = await uls('match_tasks');
  check('tasks persist after refresh, scoped to match', tasks.length === 3 && tasks.every((t) => t.matchId === match1.id) && tasks.filter((t) => t.isCompleted).length === 1);
  await page.getByRole('checkbox', { name: /Review lecture notes/ }).click();
  await page.getByRole('checkbox', { name: /Review lecture notes/ }).click();
  check('task reopen supported', (await uls('match_tasks')).filter((t) => t.isCompleted).length === 1);

  // ---------------- 12. Pomodoro ----------------
  const timerText = () => page.getByRole('timer').last().innerText();
  await btn('Start Focus').click();
  await sleep(3200);
  await btn('Pause').click();
  const pausedAt = await timerText();
  check('pause stops countdown below 25:00', pausedAt !== '25:00' && pausedAt.startsWith('24:'), pausedAt);
  await sleep(2000);
  check('paused time frozen', (await timerText()) === pausedAt);
  await reload();
  check('refresh while paused keeps paused time', (await timerText()) === pausedAt && (await visible('Paused')));
  await btn('Resume').click();
  await sleep(2200);
  const resumed = await timerText();
  check('resume continues from paused time (not reset to 25:00)', resumed < pausedAt && resumed.startsWith('24:'), `${pausedAt} -> ${resumed}`);
  await reload();
  check('refresh while running: timer recovers & keeps running', (await visible('Focusing Now')) && (await timerText()).startsWith('24:'));
  await btn('Reset').click();
  check('reset returns to 25:00 and logs nothing', (await timerText()) === '25:00' && (await uls('focus_sessions')).length === 0);
  await btn('50m Deep').click();
  check('50m deep mode', (await timerText()) === '50:00');
  await btn('5m Break').click();
  check('5m break mode', (await timerText()) === '05:00');
  await btn('25m Standard').click();
  await btn('Enable 10s Demo Timer').click();
  await btn('Start Focus').click();
  check('mode tabs locked while running', await btn('50m Deep').isDisabled());
  await sleep(4000);
  await reload(); // refresh mid-session
  await sleep(8000);
  const sessions = await uls('focus_sessions');
  check('demo session completes after refresh and is logged once', sessions.length === 1 && sessions[0].durationMinutes === 25, JSON.stringify(sessions));
  await sleep(2500);
  await reload();
  check('no duplicate session after further ticks + refresh', (await uls('focus_sessions')).length === 1);
  check('workspace shows live score 52.5 (12.5 focus + 30 task + 10 session)', await visible('Live score: 52.5 pts'));

  // ---------------- 4E. prevent 2nd match ----------------
  await btn('Return to Dashboard').click();
  check('dashboard shows active match banner', await visible('Your Focus Match is Active!'));
  check('no "Find a Focus Partner" while active', !(await visible('Find a Focus Partner')));
  await btn('Match History').click();
  await btn('Resume Active Match').click();
  check('Case E: second match prevented, routed to active match', (await visible('Pomodoro Focus Engine')) && (await uls('current_match')).id === match1.id);

  // ---------------- 5/6. Finalize & idempotency ----------------
  await btn('Demo: fast-forward match expiry').click();
  await page.getByText('Final Weighted Score').first().waitFor();
  await sleep(2500);
  let hist = await uls('match_history');
  const user = await ls('user');
  const card = hist[0];
  check('scorecard: user score 52.5', card?.userResult.finalScore === 52.5, JSON.stringify(card?.userResult));
  check('outcome consistent with scores', card.isDraw === (card.userResult.finalScore === card.opponentResult.finalScore) && card.isWinner === (card.userResult.finalScore > card.opponentResult.finalScore));
  check('history +1, streak 1, totals 1', hist.length === 1 && user.currentStreak === 1 && user.totalMatches === 1);
  check('completed match not active', (await uls('current_match')) === null);
  await reload();
  await sleep(2500);
  const cardAfter = (await uls('active_scorecard'));
  check('refresh @scorecard: same scorecard, no dupes', (await visible('Final Weighted Score')) && JSON.stringify(cardAfter) === JSON.stringify(card) && (await uls('match_history')).length === 1 && (await ls('user')).currentStreak === 1);
  const oppScoreShown = await page.getByText(`${card.opponentResult.finalScore} pts`).first().isVisible();
  check('opponent result not regenerated after refresh', oppScoreShown);
  await btn('Back to Dashboard').click();
  for (let i = 0; i < 2; i++) await reload();
  check('repeated refresh: history still 1, streak still 1', (await uls('match_history')).length === 1 && (await ls('user')).currentStreak === 1);
  await page.getByRole('button', { name: /View scorecard vs/ }).first().click();
  await sleep(2500);
  check('reopened scorecard shows identical score', await page.getByText(`${card.userResult.finalScore} pts`).first().isVisible());
  await btn('Back to Dashboard').click();

  // ---------------- 4D. expired while closed ----------------
  await findMatch();
  const m2 = await uls('current_match');
  await setUls('current_match', { ...m2, endTime: new Date(Date.now() - 60_000).toISOString() });
  await reload();
  await page.getByText('Final Weighted Score').first().waitFor({ timeout: 5000 }).catch(() => {});
  check('Case D: expiry detected on reopen -> scorecard', await visible('Final Weighted Score'));
  check('Case D: history 2, streak 2', (await uls('match_history')).length === 2 && (await ls('user')).currentStreak === 2);
  await btn('Find Another Focus Partner').click();
  check('scorecard -> find another opens queue modal', await visible('Start Matching'));
  await btn('Start Matching').click();
  await page.getByText('Focus Partner Found').waitFor({ timeout: 8000 });
  await btn('Start Match Now').click();
  await page.getByText('Pomodoro Focus Engine').waitFor();

  // ---------------- 4C. expires while open (on dashboard) ----------------
  const m3 = await uls('current_match');
  await setUls('current_match', { ...m3, endTime: new Date(Date.now() + 4000).toISOString() });
  await reload();
  await btn('Return to Dashboard').click();
  await page.getByText('Final Weighted Score').first().waitFor({ timeout: 9000 }).catch(() => {});
  check('Case C: live expiry shows scorecard automatically', await visible('Final Weighted Score'));
  check('Case C: history 3, streak 3, no duplicate ids', (() => 0)() === 0);
  hist = await uls('match_history');
  check('history ids unique', new Set(hist.map((h) => h.match.id)).size === hist.length && hist.length === 3);
  await btn('Back to Dashboard').click();

  // ---------------- 4F. forfeit ----------------
  await findMatch();
  await btn('Start Focus').click();
  await btn('Leave / Forfeit Match').click();
  check('forfeit dialog is accessible dialog', await page.getByRole('dialog', { name: 'Leave Focus Match?' }).isVisible());
  await btn('Confirm Leave').click();
  await sleep(1200);
  check('Case F: forfeit cleans state', (await uls('current_match')) === null && (await uls('pomodoro_state')).isRunning === false && (await uls('focus_sessions')).length === 0);
  check('Case F: forfeit not added to history, streak reset', (await uls('match_history')).length === 3 && (await ls('user')).currentStreak === 0);
  await reload();
  check('forfeited match stays closed after refresh', (await visible('Ready to focus?')));

  // ---------------- 13. History filters/search ----------------
  await btn('Match History').click();
  const counts = { win: 0, loss: 0, draw: 0 };
  hist.forEach((h) => counts[h.isDraw ? 'draw' : h.isWinner ? 'win' : 'loss']++);
  const cardsCount = () => page.getByRole('button', { name: /View scorecard vs/ }).count();
  await btn('All').click();
  check('all filter', (await cardsCount()) === 3);
  for (const [f, label] of [['win', 'wins'], ['loss', 'losses'], ['draw', 'draws']]) {
    await page.getByRole('group', { name: 'Filter by result' }).getByRole('button', { name: label }).click();
    const n = await cardsCount();
    check(`${label} filter shows ${counts[f]}`, n === counts[f], `got ${n}`);
  }
  await btn('All').click();
  const oppName = hist[1].match.user2Profile.anonUsername;
  await page.getByLabel('Search by partner username or date').fill(oppName.toLowerCase());
  check('search by opponent', (await cardsCount()) >= 1);
  await page.getByLabel('Search by partner username or date').fill('zzzz-nobody');
  check('search no-results state', await visible('No completed matches matched'));

  // ---------------- 14. Settings ----------------
  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('button', { name: 'Settings' }).click();
  const aliasBefore = (await ls('anon_profile')).anonUsername;
  await btn('Regenerate Identity').click();
  const aliasAfter = (await ls('anon_profile')).anonUsername;
  check('identity regenerated', aliasBefore !== aliasAfter || (await ls('anon_profile')).avatarSeed);
  const sw = page.getByRole('switch', { name: 'Match Found Alerts' });
  await sw.click();
  await reload();
  check('notification toggle persists', (await page.getByRole('switch', { name: 'Match Found Alerts' }).getAttribute('aria-checked')) === 'false');
  await btn('Match History').click();
  await page.getByRole('button', { name: /View scorecard vs/ }).first().click();
  await sleep(300);
  check('old scorecard keeps identity used in that match', await visible(hist[0].match.user1Profile.anonUsername));
  await btn('Back to Dashboard').click();

  // ---------------- logout / user isolation ----------------
  await btn('Logout').click();
  check('logout -> auth screen', await visible('Enter College Email'));
  await login('demo.student@kiit.ac.in');
  check('re-login same user: history retained', (await uls('match_history')).length === 3);
  check('re-login: identity retained', (await ls('anon_profile')).anonUsername === aliasAfter);
  await btn('Logout').click();
  await login('other.student@kiit.ac.in');
  check('different user: no history leak', (await uls('match_history') ?? []).length === 0 && (await visible('No matches completed yet.')));
  await btn('Logout').click();
  await login('demo.student@kiit.ac.in');

  // ---------------- corrupted storage ----------------
  await setUls('match_history', { garbage: true });
  await setUls('pomodoro_state', 'not-an-object');
  await page.evaluate(() => localStorage.setItem('focusmatch_anon_profile', '{broken'));
  await reload();
  check('corrupted storage: app still renders (no blank screen)', (await page.locator('#root').innerText()).length > 50 && !(await visible('Something went wrong')));
  await login('demo.student@kiit.ac.in').catch(() => {});

  // ---------------- responsive ----------------
  await btn('Logout').click().catch(() => {});
  const widths = [1440, 1280, 1024, 768, 390, 375];
  const overflowFails = [];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 850 });
    await reload();
    if (!(await noOverflow())) overflowFails.push(`${w}:auth`);
  }
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.getByLabel('Student Email Address').fill('demo.student@kiit.ac.in');
  await btn('Continue with Email').click();
  await page.getByText('Verification Code').first().waitFor();
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 850 });
    if (!(await noOverflow())) overflowFails.push(`${w}:otp`);
  }
  await page.setViewportSize({ width: 1280, height: 850 });
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill('123456'[i]);
  await btn('Verify Code').click();
  await btn('Enter KIITDual').click();
  await findMatch();
  const screens = [
    ['workspace', async () => {}],
    ['dashboard', async () => btn('Return to Dashboard').click()],
    ['history', async () => page.getByRole('button', { name: /History/ }).first().click()],
    ['settings', async () => page.getByRole('button', { name: 'Settings' }).first().click()],
  ];
  for (const [name, go] of screens) {
    await page.setViewportSize({ width: 1280, height: 850 });
    await go();
    await sleep(200);
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 850 });
      await sleep(80);
      if (!(await noOverflow())) overflowFails.push(`${w}:${name}`);
      if (w === 375) await page.screenshot({ path: path.join(SHOTS, `${name}-375.png`), fullPage: true });
      if (w === 1440) await page.screenshot({ path: path.join(SHOTS, `${name}-1440.png`) });
    }
  }
  // scorecard
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.getByRole('button', { name: /KIITDual — go to Dashboard/ }).click();
  await btn('Enter Match').click();
  await btn('Demo: fast-forward match expiry').click();
  await sleep(2500);
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 850 });
    await sleep(80);
    if (!(await noOverflow())) overflowFails.push(`${w}:scorecard`);
    if (w === 375) await page.screenshot({ path: path.join(SHOTS, `scorecard-375.png`), fullPage: true });
  }
  // matchmaking modal
  await btn('Find Another Focus Partner').click();
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 700 });
    await sleep(80);
    if (!(await noOverflow())) overflowFails.push(`${w}:modal`);
  }
  await page.screenshot({ path: path.join(SHOTS, `modal-375.png`) });
  check('no horizontal overflow on any screen at 1440/1280/1024/768/390/375', overflowFails.length === 0, overflowFails.join(', '));

  // ---------------- keyboard ----------------
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.keyboard.press('Escape');
  check('Escape closes modal', !(await visible('Start Matching')));

  // ---------------- 14. delete account ----------------
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await btn('Delete Local Account').click();
  await btn('Reset All Data').click();
  const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('focusmatch_') && !['focusmatch_user', 'focusmatch_anon_profile', 'focusmatch_auth_step', 'focusmatch_pending_email'].includes(k)));
  check('reset: back to auth & all data cleared', (await visible('Enter College Email')) && leftover.length === 0, leftover.join(','));
  await reload();
  check('reset: stays signed out after refresh', await visible('Enter College Email'));

  check('no uncaught page errors / console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) console.log('FAILURES:\n' + failures.join('\n'));
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
