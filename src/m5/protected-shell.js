import { restoreValidatedSession } from './auth-service.js';
import { getOwnProfile } from './profile-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { isOnboardingComplete, safeNextPath } from './state.js';

async function main() {
  document.body.dataset.authState = 'loading';
  const next = safeNextPath(window.location.pathname, '/student.html');
  let client;
  try {
    client = await getSupabaseClient();
  } catch {
    document.body.dataset.authState = 'anonymous';
    window.location.replace(`/login.html?next=${encodeURIComponent(next)}`);
    return;
  }

  const auth = await restoreValidatedSession(client);
  if (auth.status !== 'authenticated') {
    document.body.dataset.authState = 'anonymous';
    window.location.replace(`/login.html?next=${encodeURIComponent(next)}`);
    return;
  }

  const profile = await getOwnProfile(client, auth.user.id);
  if (!isOnboardingComplete(profile)) {
    window.location.replace('/onboarding.html');
    return;
  }

  document.body.dataset.authState = 'authenticated';
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace('/login.html');
  });
}

main().catch(() => {
  document.body.dataset.authState = 'anonymous';
  window.location.replace('/login.html');
});
