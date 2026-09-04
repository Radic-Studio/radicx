import {
  RadicBadge,
  RadicButton,
  RadicCard,
  RadicCheckbox,
  RadicDialog,
  RadicEmptyState,
  RadicInput,
  RadicProgress,
  RadicRadio,
  RadicSelect,
  RadicSheet,
  RadicSkeleton,
  RadicStat,
  RadicSyncState,
  RadicTabs,
  RadicTextarea,
  RadicTooltip
} from './components/radic-components.js';
import { initRadicInteractions } from './components/radic-interactions.js';

function renderComponentLab() {
  const lab = document.querySelector('[data-component-lab]');
  if (!lab) return;

  const buttons = document.createElement('div');
  buttons.className = 'radic-cluster';
  for (const variant of ['primary', 'secondary', 'ghost', 'destructive', 'text', 'icon']) {
    buttons.append(RadicButton({ label: variant === 'icon' ? '+' : variant, variant, ariaLabel: variant === 'icon' ? 'Add item' : undefined }));
  }

  const forms = document.createElement('div');
  forms.className = 'radic-stack';
  forms.append(
    RadicInput({ label: 'Email address', type: 'email', placeholder: 'student@example.com', hint: 'Native input with RadicX focus treatment.' }),
    RadicTextarea({ label: 'Notes', placeholder: 'Add a concise note' }),
    RadicSelect({ label: 'Practice length', options: [{ label: 'Quick', value: 'quick' }, { label: 'Standard', value: 'standard' }] }),
    RadicCheckbox({ label: 'Remember this preference' }),
    RadicRadio({ label: 'Option A', name: 'demo-radio', value: 'a', checked: true }),
    RadicRadio({ label: 'Option B', name: 'demo-radio', value: 'b' })
  );

  const statuses = document.createElement('div');
  statuses.className = 'radic-stack';
  const badges = document.createElement('div');
  badges.className = 'radic-cluster';
  badges.append(
    RadicBadge({ label: 'Neutral', tone: 'neutral' }),
    RadicBadge({ label: 'Complete', tone: 'success' }),
    RadicBadge({ label: 'Review due', tone: 'review' }),
    RadicBadge({ label: 'Warning', tone: 'warning' }),
    RadicBadge({ label: 'Needs attention', tone: 'error' })
  );
  const sync = document.createElement('div');
  sync.className = 'radic-cluster';
  sync.append(
    RadicSyncState({ label: 'Online', tone: 'success' }),
    RadicSyncState({ label: 'Syncing…', tone: 'neutral' }),
    RadicSyncState({ label: 'Offline · progress saved on this device', tone: 'offline' }),
    RadicSyncState({ label: 'Sync required', tone: 'warning' })
  );
  statuses.append(badges, sync, RadicProgress({ value: 62, label: 'Example progress' }));

  const feedback = document.createElement('div');
  feedback.className = 'radic-stack';
  feedback.append(
    RadicStat({ label: 'Readiness', value: '—', supporting: 'No learning data is fabricated in M3.' }),
    RadicSkeleton({ height: '22px' }),
    RadicSkeleton({ width: '72%', height: '22px' }),
    RadicEmptyState({ title: 'Foundation only', body: 'Learning data and business logic arrive in their approved milestones.' }),
    RadicTooltip({ label: 'About tooltips', text: 'Visible with pointer hover and keyboard focus.' })
  );

  const overlays = document.createElement('div');
  overlays.className = 'radic-cluster';
  const dialog = RadicDialog({ id: 'component-dialog', title: 'RadicDialog', body: 'Native dialog semantics with restrained styling.' });
  const sheet = RadicSheet({ id: 'component-sheet', title: 'RadicSheet', body: 'A responsive overlay primitive for navigation or secondary tasks.' });
  const dialogTrigger = RadicButton({ label: 'Open dialog', variant: 'secondary' });
  dialogTrigger.dataset.dialogOpen = 'component-dialog';
  const sheetTrigger = RadicButton({ label: 'Open sheet', variant: 'secondary' });
  sheetTrigger.dataset.sheetOpen = 'component-sheet';
  const toastTrigger = RadicButton({ label: 'Show toast', variant: 'secondary' });
  toastTrigger.dataset.toastMessage = 'Interface state updated.';
  overlays.append(dialogTrigger, sheetTrigger, toastTrigger, dialog, sheet);

  const tabs = RadicTabs({
    tabs: [
      { label: 'Foundation', content: 'Tokens, primitives and shells.' },
      { label: 'Behavior', content: 'Keyboard, focus, motion and feedback states.' },
      { label: 'Scope', content: 'No learning, exam, auth or payment logic in M3.' }
    ]
  });

  const card = RadicCard({
    title: 'Clinical Luxury × Expressive Intelligence',
    body: 'A restrained clinical foundation with selective Radic Prism expression.'
  });

  lab.append(buttons, forms, statuses, feedback, overlays, tabs, card);
}

initRadicInteractions(document);
renderComponentLab();

document.documentElement.dataset.radicReady = 'true';
