import { restoreValidatedSession, signOutLocally } from './auth-service.js';
import { discoverResumableSession, getOwnProfile, getProgramme } from './profile-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { dashboardViewModel, isOnboardingComplete } from './state.js';

function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatDate(value) {
  if (!value) return 'Not set';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
}

async function main() {
  document.body.dataset.authState = 'loading';
  let client;
  try {
    client = await getSupabaseClient();
  } catch {
    document.body.dataset.authState = 'anonymous';
    window.location.replace('/login.html?next=/student.html');
    return;
  }

  const auth = await restoreValidatedSession(client);
  if (auth.status !== 'authenticated') {
    document.body.dataset.authState = 'anonymous';
    window.location.replace('/login.html?next=/student.html');
    return;
  }

  const profile = await getOwnProfile(client, auth.user.id);
  if (!isOnboardingComplete(profile)) {
    window.location.replace('/onboarding.html');
    return;
  }

  const [programme, resumableSession] = await Promise.all([
    getProgramme(client, profile.programme_id),
    discoverResumableSession(client)
  ]);
  const model = dashboardViewModel({ profile, programme, resumableSession });

  text('student-name', model.displayName);
  text('programme-name', model.programmeName);
  text('exam-date', formatDate(model.examDate));
  text('exam-countdown', model.countdown.label);
  text('daily-study', model.dailyStudyMinutes ? `${model.dailyStudyMinutes} minutes` : 'Not set');
  text('next-action-title', model.nextAction.title);
  text('next-action-body', model.nextAction.body);
  text('next-action-label', model.nextAction.label);
  text('session-state', resumableSession ? `${resumableSession.status} · ${resumableSession.mode}` : 'No resumable session found');

  document.body.dataset.authState = 'authenticated';

  for (const button of document.querySelectorAll('[data-logout]')) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await signOutLocally(client);
      } finally {
        window.location.replace('/login.html');
      }
    });
  }

  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace('/login.html');
  });
}

main().catch((error) => {
  document.body.dataset.authState = 'anonymous';
  console.error('M5 dashboard initialization failed', error);
  window.location.replace('/login.html?next=/student.html');
});
