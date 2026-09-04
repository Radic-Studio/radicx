export async function restoreValidatedSession(client) {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData?.session) {
    return { status: 'anonymous', session: null, user: null, reason: sessionError ? 'session_error' : 'no_session' };
  }

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) {
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch {
      // The local session is treated as invalid even if remote logout cannot complete.
    }
    return { status: 'anonymous', session: null, user: null, reason: 'invalid_session' };
  }

  return {
    status: 'authenticated',
    session: sessionData.session,
    user: userData.user,
    reason: null
  };
}

export function authCallbackUrl(flow, locationLike = globalThis.window?.location) {
  if (!locationLike?.origin) throw new Error('Cannot build an authentication callback URL.');
  const url = new URL('/auth-callback.html', locationLike.origin);
  url.searchParams.set('flow', flow === 'recovery' ? 'recovery' : 'signup');
  return url.toString();
}

export async function signUpWithEmail(client, { email, password, displayName, redirectTo }) {
  return client.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: redirectTo
    }
  });
}

export async function resendSignupVerification(client, { email, redirectTo }) {
  return client.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: redirectTo }
  });
}

export async function signInWithPassword(client, { email, password }) {
  return client.auth.signInWithPassword({ email, password });
}

export async function requestPasswordReset(client, { email, redirectTo }) {
  return client.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function exchangeAuthCode(client, code) {
  return client.auth.exchangeCodeForSession(code);
}

export async function updatePassword(client, password) {
  return client.auth.updateUser({ password });
}

export async function signOutLocally(client) {
  return client.auth.signOut({ scope: 'local' });
}
