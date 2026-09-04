import {
  authCallbackUrl,
  exchangeAuthCode,
  requestPasswordReset,
  resendSignupVerification,
  restoreValidatedSession,
  signInWithPassword,
  signOutLocally,
  signUpWithEmail,
  updatePassword
} from './auth-service.js';
import { getOwnProfile } from './profile-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { destinationAfterAuthentication, parseAuthCallback, safeNextPath } from './state.js';

const page = document.body.dataset.m5Page;

function byId(id) {
  return document.getElementById(id);
}

function setMessage(element, message = '', tone = 'neutral') {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
}

function setBusy(form, busy) {
  if (!form) return;
  const submit = form.querySelector('[type="submit"]');
  if (submit) {
    submit.disabled = busy;
    submit.setAttribute('aria-busy', String(busy));
  }
}

function friendlyAuthError(error, fallback = 'We could not complete that request. Please check the details and try again.') {
  const message = String(error?.message ?? '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Please verify your email before signing in.';
  if (message.includes('password')) return fallback;
  if (message.includes('rate') || message.includes('too many')) return 'Too many attempts. Please wait a moment and try again.';
  return fallback;
}

function initPasswordToggles(root = document) {
  for (const button of root.querySelectorAll('[data-password-toggle]')) {
    button.addEventListener('click', () => {
      const input = byId(button.dataset.passwordToggle);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', String(reveal));
    });
  }
}

async function redirectIfAlreadyAuthenticated(client, next) {
  const auth = await restoreValidatedSession(client);
  if (auth.status !== 'authenticated') return false;
  const profile = await getOwnProfile(client, auth.user.id);
  window.location.replace(destinationAfterAuthentication(profile, next));
  return true;
}

async function initLogin(client) {
  const next = safeNextPath(new URL(window.location.href).searchParams.get('next'), '/student.html');
  const form = byId('login-form');
  const message = byId('login-message');
  if (await redirectIfAlreadyAuthenticated(client, next)) return;

  if (new URL(window.location.href).searchParams.get('reset') === 'success') {
    setMessage(message, 'Password updated. Sign in with your new password.', 'success');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(form, true);
    setMessage(message, 'Signing you in…');
    try {
      const email = byId('login-email').value.trim();
      const password = byId('login-password').value;
      const { data, error } = await signInWithPassword(client, { email, password });
      if (error || !data?.user) throw error ?? new Error('No authenticated user returned.');
      const profile = await getOwnProfile(client, data.user.id);
      window.location.assign(destinationAfterAuthentication(profile, next));
    } catch (error) {
      setMessage(message, friendlyAuthError(error), 'error');
      setBusy(form, false);
    }
  });
}

async function initSignup(client) {
  const form = byId('signup-form');
  const message = byId('signup-message');
  if (await redirectIfAlreadyAuthenticated(client, '/student.html')) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayName = byId('signup-name').value.trim();
    const email = byId('signup-email').value.trim();
    const password = byId('signup-password').value;
    const confirm = byId('signup-password-confirm').value;

    if (password.length < 8) {
      setMessage(message, 'Use at least 8 characters for your password.', 'error');
      return;
    }
    if (password !== confirm) {
      setMessage(message, 'The passwords do not match.', 'error');
      return;
    }

    setBusy(form, true);
    setMessage(message, 'Creating your account…');
    try {
      const { data, error } = await signUpWithEmail(client, {
        email,
        password,
        displayName,
        redirectTo: authCallbackUrl('signup')
      });
      if (error) throw error;

      sessionStorage.setItem('radicx.pendingVerificationEmail', email);
      if (data?.session && data?.user) {
        const profile = await getOwnProfile(client, data.user.id);
        window.location.assign(destinationAfterAuthentication(profile, '/student.html'));
        return;
      }
      window.location.assign('/verify-email.html');
    } catch (error) {
      setMessage(message, friendlyAuthError(error, 'Account creation could not be completed. Check your details and try again.'), 'error');
      setBusy(form, false);
    }
  });
}

async function initVerify(client) {
  const form = byId('verify-form');
  const message = byId('verify-message');
  const emailInput = byId('verify-email');
  emailInput.value = sessionStorage.getItem('radicx.pendingVerificationEmail') ?? '';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    setBusy(form, true);
    setMessage(message, 'Requesting a new verification email…');
    try {
      const { error } = await resendSignupVerification(client, {
        email,
        redirectTo: authCallbackUrl('signup')
      });
      if (error) throw error;
      sessionStorage.setItem('radicx.pendingVerificationEmail', email);
      setMessage(message, 'If the account is eligible, a new verification email has been sent.', 'success');
    } catch (error) {
      setMessage(message, friendlyAuthError(error, 'A new verification email could not be requested right now.'), 'error');
    } finally {
      setBusy(form, false);
    }
  });
}

async function initForgot(client) {
  const form = byId('forgot-form');
  const message = byId('forgot-message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(form, true);
    setMessage(message, 'Requesting password reset…');
    try {
      const { error } = await requestPasswordReset(client, {
        email: byId('forgot-email').value.trim(),
        redirectTo: authCallbackUrl('recovery')
      });
      if (error) throw error;
      setMessage(message, 'If that email can receive a reset link, it has been sent. Check your inbox and spam folder.', 'success');
    } catch (error) {
      setMessage(message, friendlyAuthError(error, 'Password recovery could not be requested right now.'), 'error');
    } finally {
      setBusy(form, false);
    }
  });
}

async function initCallback(client) {
  const message = byId('callback-message');
  const callback = parseAuthCallback(window.location.href);
  if (callback.error) {
    setMessage(message, callback.errorDescription || 'This authentication link is invalid or has expired.', 'error');
    return;
  }
  if (!callback.code) {
    setMessage(message, 'This authentication link is incomplete or has expired.', 'error');
    return;
  }

  setMessage(message, 'Confirming your secure link…');
  try {
    const { data, error } = await exchangeAuthCode(client, callback.code);
    if (error || !data?.user) throw error ?? new Error('Authentication code exchange failed.');
    history.replaceState(null, '', '/auth-callback.html');
    if (callback.flow === 'recovery') {
      window.location.replace('/reset-password.html');
      return;
    }
    sessionStorage.removeItem('radicx.pendingVerificationEmail');
    const profile = await getOwnProfile(client, data.user.id);
    window.location.replace(destinationAfterAuthentication(profile, '/student.html'));
  } catch {
    history.replaceState(null, '', '/auth-callback.html');
    setMessage(message, 'This authentication link is invalid or has expired. Request a new link and try again.', 'error');
  }
}

async function initReset(client) {
  const form = byId('reset-form');
  const message = byId('reset-message');
  const auth = await restoreValidatedSession(client);
  if (auth.status !== 'authenticated') {
    form.hidden = true;
    setMessage(message, 'This reset session is invalid or has expired. Request a new password-reset link.', 'error');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = byId('reset-password').value;
    const confirm = byId('reset-password-confirm').value;
    if (password.length < 8) {
      setMessage(message, 'Use at least 8 characters for your new password.', 'error');
      return;
    }
    if (password !== confirm) {
      setMessage(message, 'The passwords do not match.', 'error');
      return;
    }

    setBusy(form, true);
    setMessage(message, 'Updating your password…');
    try {
      const { error } = await updatePassword(client, password);
      if (error) throw error;
      await signOutLocally(client);
      window.location.replace('/login.html?reset=success');
    } catch (error) {
      setMessage(message, friendlyAuthError(error, 'Your password could not be updated. Request a new reset link if this session has expired.'), 'error');
      setBusy(form, false);
    }
  });
}

async function main() {
  initPasswordToggles();
  const topMessage = document.querySelector('[data-auth-config-message]');
  let client;
  try {
    client = await getSupabaseClient();
  } catch {
    setMessage(topMessage, 'Authentication is unavailable in this environment because its public configuration is incomplete.', 'error');
    for (const form of document.querySelectorAll('form')) {
      for (const control of form.elements) control.disabled = true;
    }
    return;
  }

  if (page === 'login') await initLogin(client);
  else if (page === 'signup') await initSignup(client);
  else if (page === 'verify') await initVerify(client);
  else if (page === 'forgot') await initForgot(client);
  else if (page === 'callback') await initCallback(client);
  else if (page === 'reset') await initReset(client);
}

main().catch((error) => {
  const message = document.querySelector('[data-auth-config-message]');
  setMessage(message, 'Authentication could not be initialized. Please reload and try again.', 'error');
  console.error('M5 auth initialization failed', error);
});
