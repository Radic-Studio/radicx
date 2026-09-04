import assert from 'node:assert/strict';
import test from 'node:test';

import { restoreValidatedSession } from '../src/m5/auth-service.js';
import {
  dashboardViewModel,
  destinationAfterAuthentication,
  examCountdown,
  getResumeOnboardingStep,
  isOnboardingComplete,
  parseAuthCallback,
  safeNextPath
} from '../src/m5/state.js';

const completeProfile = {
  programme_id: 'programme-1',
  expected_exam_date: '2026-12-15',
  daily_study_minutes: 30,
  onboarding_status: 'completed',
  onboarding_current_step: 4,
  onboarding_version: 1,
  onboarding_completed_at: '2026-09-04T10:00:00Z',
  diagnostic_invitation_decision: 'skip'
};

test('safeNextPath allows only approved local protected routes', () => {
  assert.equal(safeNextPath('/exam.html'), '/exam.html');
  assert.equal(safeNextPath('https://evil.example/'), '/student.html');
  assert.equal(safeNextPath('//evil.example/'), '/student.html');
  assert.equal(safeNextPath('/admin.html'), '/student.html');
});

test('auth callback parser distinguishes signup, recovery and provider errors', () => {
  assert.deepEqual(parseAuthCallback('https://radicx.example/auth-callback.html?flow=recovery&code=abc'), {
    flow: 'recovery',
    code: 'abc',
    error: null,
    errorDescription: null
  });
  assert.equal(parseAuthCallback('https://radicx.example/auth-callback.html?error=access_denied').error, 'access_denied');
});

test('onboarding completion requires all persisted M5 fields', () => {
  assert.equal(isOnboardingComplete(completeProfile), true);
  assert.equal(isOnboardingComplete({ ...completeProfile, daily_study_minutes: 25 }), false);
  assert.equal(isOnboardingComplete({ ...completeProfile, onboarding_completed_at: null }), false);
});

test('onboarding resumes the persisted valid step and clamps malformed progression', () => {
  assert.equal(getResumeOnboardingStep({ onboarding_status: 'not_started' }), 1);
  assert.equal(getResumeOnboardingStep({ onboarding_status: 'in_progress', programme_id: 'p', onboarding_current_step: 2 }), 2);
  assert.equal(getResumeOnboardingStep({ onboarding_status: 'in_progress', programme_id: 'p', onboarding_current_step: 4 }), 2);
  assert.equal(getResumeOnboardingStep({ ...completeProfile, onboarding_status: 'in_progress', onboarding_completed_at: null, onboarding_current_step: 2 }), 2);
  assert.equal(getResumeOnboardingStep(completeProfile), 0);
});

test('post-auth routing sends incomplete users to onboarding and preserves safe completed-user destinations', () => {
  assert.equal(destinationAfterAuthentication({ onboarding_status: 'not_started' }, '/exam.html'), '/onboarding.html');
  assert.equal(destinationAfterAuthentication(completeProfile, '/exam.html'), '/exam.html');
  assert.equal(destinationAfterAuthentication(completeProfile, '/onboarding.html'), '/student.html');
});

test('session restoration validates persisted sessions against the Auth server', async () => {
  const validClient = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'public-test-token' } }, error: null }),
      getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      signOut: async () => ({ error: null })
    }
  };
  assert.equal((await restoreValidatedSession(validClient)).status, 'authenticated');

  let signedOut = false;
  const invalidClient = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'expired-test-token' } }, error: null }),
      getUser: async () => ({ data: { user: null }, error: new Error('expired') }),
      signOut: async () => {
        signedOut = true;
        return { error: null };
      }
    }
  };
  assert.equal((await restoreValidatedSession(invalidClient)).status, 'anonymous');
  assert.equal(signedOut, true);
});

test('countdown and dashboard model remain truthful without later-milestone analytics', () => {
  assert.deepEqual(examCountdown('2026-09-05', new Date('2026-09-04T12:00:00Z')), {
    kind: 'future',
    days: 1,
    label: '1 day to expected exam date'
  });

  const model = dashboardViewModel({
    profile: { ...completeProfile, display_name: 'Ada' },
    programme: { name: 'NMCN Midwifery CBT Preparation' },
    resumableSession: { id: 'session-1', status: 'active' },
    now: new Date('2026-09-04T12:00:00Z')
  });

  assert.equal(model.displayName, 'Ada');
  assert.equal(model.nextAction.kind, 'resume');
  assert.match(model.nextAction.body, /M6/);
});
