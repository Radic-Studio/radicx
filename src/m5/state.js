export const M5_ONBOARDING_VERSION = 1;
export const DAILY_STUDY_OPTIONS = Object.freeze([10, 20, 30, 45, 60]);

const protectedPaths = new Set(['/student.html', '/focus.html', '/exam.html', '/onboarding.html']);

export function safeNextPath(value, fallback = '/student.html') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;

  try {
    const parsed = new URL(value, 'https://radicx.invalid');
    if (parsed.origin !== 'https://radicx.invalid') return fallback;
    if (!protectedPaths.has(parsed.pathname)) return fallback;
    return parsed.pathname;
  } catch {
    return fallback;
  }
}

export function parseAuthCallback(input) {
  const url = input instanceof URL ? input : new URL(input, 'https://radicx.invalid');
  const flow = url.searchParams.get('flow');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  return {
    flow: flow === 'recovery' ? 'recovery' : 'signup',
    code,
    error,
    errorDescription
  };
}

export function isOnboardingComplete(profile) {
  return Boolean(
    profile
      && profile.onboarding_status === 'completed'
      && profile.onboarding_version === M5_ONBOARDING_VERSION
      && profile.programme_id
      && profile.expected_exam_date
      && DAILY_STUDY_OPTIONS.includes(Number(profile.daily_study_minutes))
      && ['start', 'skip'].includes(profile.diagnostic_invitation_decision)
      && profile.onboarding_completed_at
  );
}

export function getResumeOnboardingStep(profile) {
  if (!profile || profile.onboarding_status === 'not_started') return 1;
  if (isOnboardingComplete(profile)) return 0;

  let highestValidStep = 1;
  if (profile.programme_id) highestValidStep = 2;
  if (profile.programme_id && profile.expected_exam_date) highestValidStep = 3;
  if (profile.programme_id && profile.expected_exam_date && DAILY_STUDY_OPTIONS.includes(Number(profile.daily_study_minutes))) {
    highestValidStep = 4;
  }

  const persisted = Number(profile.onboarding_current_step);
  if (!Number.isInteger(persisted) || persisted < 1 || persisted > 4) return highestValidStep;
  return Math.min(persisted, highestValidStep);
}

export function destinationAfterAuthentication(profile, requestedNext) {
  if (!isOnboardingComplete(profile)) return '/onboarding.html';
  return safeNextPath(requestedNext, '/student.html') === '/onboarding.html'
    ? '/student.html'
    : safeNextPath(requestedNext, '/student.html');
}

function utcDateOnly(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function examCountdown(expectedExamDate, now = new Date()) {
  const target = utcDateOnly(expectedExamDate);
  if (target === null) return { kind: 'unknown', label: 'Exam date not set' };

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.ceil((target - today) / 86400000);
  if (days < 0) return { kind: 'past', days, label: 'Expected exam date has passed' };
  if (days === 0) return { kind: 'today', days: 0, label: 'Expected exam date is today' };
  if (days === 1) return { kind: 'future', days: 1, label: '1 day to expected exam date' };
  return { kind: 'future', days, label: `${days} days to expected exam date` };
}

export function dashboardViewModel({ profile, programme, resumableSession, now = new Date() }) {
  const countdown = examCountdown(profile?.expected_exam_date, now);
  const displayName = profile?.display_name?.trim() || 'Student';

  let nextAction;
  if (resumableSession) {
    nextAction = {
      kind: 'resume',
      title: 'An existing session is ready to resume',
      body: 'RadicX found a valid unfinished session. M6 will activate the question-flow resume action without changing this stored session.',
      label: 'Resume becomes active in M6'
    };
  } else if (profile?.diagnostic_invitation_decision === 'start') {
    nextAction = {
      kind: 'diagnostic',
      title: 'Diagnostic preference saved',
      body: 'You chose to start the diagnostic. The diagnostic engine belongs to M7, so RadicX has saved the handoff without fabricating a result.',
      label: 'Diagnostic becomes active in M7'
    };
  } else {
    nextAction = {
      kind: 'study',
      title: 'Your student foundation is ready',
      body: 'Study recommendations and question flow are intentionally unavailable until their approved milestones.',
      label: 'Study Engine becomes active in M6'
    };
  }

  return {
    displayName,
    programmeName: programme?.name || 'NMCN Midwifery CBT Preparation',
    examDate: profile?.expected_exam_date || null,
    countdown,
    dailyStudyMinutes: profile?.daily_study_minutes || null,
    nextAction
  };
}
