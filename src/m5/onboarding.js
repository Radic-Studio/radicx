import { restoreValidatedSession } from './auth-service.js';
import { getOwnProfile, listActiveProgrammes, updateOwnProfile } from './profile-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { DAILY_STUDY_OPTIONS, getResumeOnboardingStep, isOnboardingComplete } from './state.js';

const form = document.getElementById('onboarding-form');
const message = document.getElementById('onboarding-message');
const panel = document.getElementById('onboarding-step-content');
const title = document.getElementById('onboarding-title');
const supporting = document.getElementById('onboarding-supporting');
const backButton = document.getElementById('onboarding-back');
const nextButton = document.getElementById('onboarding-next');
const stepItems = [...document.querySelectorAll('[data-onboarding-step]')];

let client;
let user;
let profile;
let programmes = [];
let step = 1;

function setMessage(text = '', tone = 'neutral') {
  message.textContent = text;
  message.dataset.tone = tone;
}

function setBusy(busy) {
  backButton.disabled = busy || step === 1;
  nextButton.disabled = busy;
  nextButton.setAttribute('aria-busy', String(busy));
}

function updateStepIndicator() {
  for (const item of stepItems) {
    const itemStep = Number(item.dataset.onboardingStep);
    item.dataset.state = itemStep < step ? 'complete' : itemStep === step ? 'current' : 'upcoming';
    if (itemStep === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  }
}

function optionEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function renderStep() {
  updateStepIndicator();
  backButton.disabled = step === 1;
  nextButton.textContent = step === 4 ? 'Complete onboarding' : 'Save and continue';
  setMessage('');

  if (step === 1) {
    title.textContent = 'Choose your programme';
    supporting.textContent = 'This keeps your preparation aligned to the active RadicX curriculum.';
    const options = programmes.map((programme) => `<option value="${optionEscape(programme.id)}"${programme.id === profile.programme_id ? ' selected' : ''}>${optionEscape(programme.name)}</option>`).join('');
    panel.innerHTML = `<div class="radic-field"><label class="radic-label" for="programme">Programme</label><select class="radic-select" id="programme" name="programme" required><option value="">Select a programme</option>${options}</select><p class="radic-field__hint">Only active programmes can be selected.</p></div>`;
  } else if (step === 2) {
    title.textContent = 'Set your expected exam date';
    supporting.textContent = 'Use the date you currently expect to sit the examination. You can update it before later planning logic uses it.';
    panel.innerHTML = `<div class="radic-field"><label class="radic-label" for="exam-date">Expected exam date</label><input class="radic-input" id="exam-date" name="exam-date" type="date" value="${optionEscape(profile.expected_exam_date ?? '')}" required /><p class="radic-field__hint">RadicX uses this only as a preparation-planning input. It is not an official examination booking record.</p></div>`;
  } else if (step === 3) {
    title.textContent = 'Choose a daily study target';
    supporting.textContent = 'Pick a realistic default. This is a preference, not a streak obligation.';
    panel.innerHTML = `<fieldset class="radic-field"><legend class="radic-label">Daily study time</legend><div class="m5-study-options">${DAILY_STUDY_OPTIONS.map((minutes) => `<label class="m5-option-card"><input type="radio" name="daily-study" value="${minutes}"${Number(profile.daily_study_minutes) === minutes ? ' checked' : ''} required /><span><strong>${minutes} minutes</strong><br /><span class="radic-supporting-text">per meaningful study day</span></span></label>`).join('')}</div></fieldset>`;
  } else {
    title.textContent = 'Choose your diagnostic handoff';
    supporting.textContent = 'M5 records your choice. The actual diagnostic belongs to the M7 Learning & Review Engine.';
    panel.innerHTML = `<fieldset class="radic-field"><legend class="radic-label">What should happen next?</legend><div class="m5-diagnostic-options"><label class="m5-option-card"><input type="radio" name="diagnostic" value="start"${profile.diagnostic_invitation_decision === 'start' ? ' checked' : ''} required /><span><strong>Start diagnostic</strong><br /><span class="radic-supporting-text">Save my preference to begin when the diagnostic engine is available.</span></span></label><label class="m5-option-card"><input type="radio" name="diagnostic" value="skip"${profile.diagnostic_invitation_decision === 'skip' ? ' checked' : ''} required /><span><strong>Skip for now</strong><br /><span class="radic-supporting-text">Enter the student application without a diagnostic result.</span></span></label></div></fieldset>`;
  }
}

async function persistStep() {
  let patch;
  if (step === 1) {
    const programmeId = document.getElementById('programme').value;
    if (!programmeId) throw new Error('Select a programme to continue.');
    patch = { programme_id: programmeId, onboarding_status: 'in_progress', onboarding_current_step: 2 };
  } else if (step === 2) {
    const expectedExamDate = document.getElementById('exam-date').value;
    if (!expectedExamDate) throw new Error('Choose your expected exam date to continue.');
    patch = { expected_exam_date: expectedExamDate, onboarding_status: 'in_progress', onboarding_current_step: 3 };
  } else if (step === 3) {
    const selected = document.querySelector('input[name="daily-study"]:checked');
    if (!selected) throw new Error('Choose a daily study target to continue.');
    patch = { daily_study_minutes: Number(selected.value), onboarding_status: 'in_progress', onboarding_current_step: 4 };
  } else {
    const selected = document.querySelector('input[name="diagnostic"]:checked');
    if (!selected) throw new Error('Choose whether to start or skip the diagnostic.');
    patch = { diagnostic_invitation_decision: selected.value, onboarding_status: 'completed', onboarding_current_step: 4 };
  }

  profile = await updateOwnProfile(client, user.id, patch);
  if (step === 4) {
    if (!isOnboardingComplete(profile)) throw new Error('Onboarding completion was not accepted by the server.');
    setMessage('Onboarding saved. Opening your student application…', 'success');
    window.location.replace('/student.html');
    return;
  }
  step += 1;
  renderStep();
  panel.querySelector('input, select')?.focus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(true);
  setMessage('Saving your progress…');
  try {
    await persistStep();
  } catch (error) {
    setMessage(error?.message || 'Your onboarding progress could not be saved. Try again.', 'error');
  } finally {
    setBusy(false);
  }
});

backButton.addEventListener('click', async () => {
  if (step <= 1) return;
  setBusy(true);
  setMessage('Saving your place…');
  try {
    step -= 1;
    profile = await updateOwnProfile(client, user.id, {
      onboarding_status: 'in_progress',
      onboarding_current_step: step
    });
    renderStep();
    panel.querySelector('input, select')?.focus();
  } catch {
    step += 1;
    setMessage('Your place could not be saved. Try again.', 'error');
  } finally {
    setBusy(false);
  }
});

async function main() {
  document.body.dataset.authState = 'loading';
  try {
    client = await getSupabaseClient();
  } catch {
    document.body.dataset.authState = 'anonymous';
    window.location.replace('/login.html?next=/onboarding.html');
    return;
  }

  const auth = await restoreValidatedSession(client);
  if (auth.status !== 'authenticated') {
    document.body.dataset.authState = 'anonymous';
    window.location.replace('/login.html?next=/onboarding.html');
    return;
  }

  user = auth.user;
  [profile, programmes] = await Promise.all([
    getOwnProfile(client, user.id),
    listActiveProgrammes(client)
  ]);

  if (isOnboardingComplete(profile)) {
    window.location.replace('/student.html');
    return;
  }
  if (!programmes.length) {
    document.body.dataset.authState = 'authenticated';
    form.hidden = true;
    setMessage('No active programme is currently available. Your account is safe, but onboarding cannot continue yet.', 'error');
    return;
  }

  step = getResumeOnboardingStep(profile) || 1;
  renderStep();
  document.body.dataset.authState = 'authenticated';

  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace('/login.html');
  });
}

main().catch((error) => {
  document.body.dataset.authState = 'authenticated';
  form.hidden = true;
  setMessage('Onboarding could not be loaded safely. Reload the page and try again.', 'error');
  console.error('M5 onboarding initialization failed', error);
});
