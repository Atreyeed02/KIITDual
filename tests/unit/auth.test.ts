/**
 * Auth service checks that run offline. Login itself is a real Supabase email
 * OTP flow (see authService.ts), so only the client-side rules are covered here:
 * non-college addresses are rejected before any network call, and logout clears
 * the locally stored session keys.
 */
import { mem, eq, finish } from './setup';
import { authService } from '../../src/services/authService';

(async () => {
  const gmail = await authService.requestOtp('someone@gmail.com');
  eq('non-college domain rejected', gmail.success, false);
  eq('non-college domain gives an error message', typeof gmail.error, 'string');
  eq('rejected email is not stored as pending', mem.has('focusmatch_pending_otp_email'), false);

  const malformed = await authService.requestOtp('not-an-email');
  eq('malformed email rejected', malformed.success, false);

  for (const k of ['user', 'anon_profile', 'auth_step', 'pending_otp_email']) {
    mem.set('focusmatch_' + k, '"x"');
  }
  await authService.logout();
  eq(
    'logout clears session keys',
    ['user', 'anon_profile', 'auth_step', 'pending_otp_email'].some((k) => mem.has('focusmatch_' + k)),
    false
  );

  finish();
})();
