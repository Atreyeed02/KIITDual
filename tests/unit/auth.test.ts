/**
 * Simulated auth privacy rules: the college email is stored only as a one-way
 * hash, never as a reversible encoding, and legacy base64-keyed accounts are
 * migrated without losing their user id (and therefore their data).
 */
import { mem, eq, finish } from './setup';
import { authService } from '../../src/services/authService';

const keys = () => Array.from(mem.keys());
const EMAIL = 'Roll.2105123@KIIT.ac.in';
const NORMALIZED = EMAIL.trim().toLowerCase();

async function signIn(email: string) {
  const req = await authService.requestOtp(email);
  if (!req.success) throw new Error(req.error);
  return authService.verifyOtp(email, '123456');
}

(async () => {
  eq('non-college domain rejected', (await authService.requestOtp('someone@gmail.com')).success, false);
  await authService.requestOtp(EMAIL);
  eq('wrong code rejected', (await authService.verifyOtp(EMAIL, '000000')).success, false);

  const first = await signIn(EMAIL);
  const hash = first.user!.collegeEmailHash;
  eq('email stored as 64-char SHA-256 hex', /^[0-9a-f]{64}$/.test(hash), true);
  eq('hash is not the reversible base64 prefix', hash === btoa(NORMALIZED).substring(0, 16), false);
  const dump = keys().map((k) => k + '=' + mem.get(k)).join('\n');
  eq('no plaintext email anywhere in storage after sign-in', dump.toLowerCase().includes(NORMALIZED), false);
  eq('pending OTP state cleared', [mem.has('focusmatch_pending_otp_email'), mem.has('focusmatch_simulated_otp')], [false, false]);

  const again = await signIn('  ' + EMAIL.toUpperCase() + ' ');
  eq('same (normalized) email -> same account', again.user!.id, first.user!.id);

  // Legacy account created by an earlier build (reversible base64 key).
  mem.clear();
  const legacyEmail = 'legacy.student@kiit.ac.in';
  const legacyKey = btoa(legacyEmail).substring(0, 16);
  const legacyUser = {
    id: 'usr_legacy_1', collegeEmailHash: legacyKey, isVerified: true, createdAt: '2026-01-01T00:00:00Z',
    currentStreak: 4, totalMatches: 9, totalWins: 5, totalLosses: 3, totalDraws: 1,
  };
  const legacyProfile = { id: 'prof_1', userId: 'usr_legacy_1', anonUsername: 'CalmOwl905', avatarSeed: 'seed', rotatesPerMatch: false };
  mem.set(`focusmatch_user_${legacyKey}`, JSON.stringify(legacyUser));
  mem.set(`focusmatch_profile_${legacyKey}`, JSON.stringify(legacyProfile));

  const migrated = await signIn(legacyEmail);
  eq('legacy account keeps its user id (per-user data preserved)', migrated.user!.id, 'usr_legacy_1');
  eq('legacy stats + identity preserved', [migrated.user!.currentStreak, migrated.profile!.anonUsername], [4, 'CalmOwl905']);
  eq('legacy account re-keyed under the hash', /^[0-9a-f]{64}$/.test(migrated.user!.collegeEmailHash), true);
  eq('reversible legacy keys removed', [mem.has(`focusmatch_user_${legacyKey}`), mem.has(`focusmatch_profile_${legacyKey}`)], [false, false]);

  authService.logout();
  eq('logout clears session keys', ['user', 'anon_profile', 'auth_step'].some((k) => mem.has('focusmatch_' + k)), false);

  finish();
})();
