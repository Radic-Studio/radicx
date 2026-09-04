const variants = new Set(['primary', 'secondary', 'ghost', 'destructive', 'text', 'icon']);
const badgeTones = new Set(['neutral', 'success', 'warning', 'error', 'review']);
const syncTones = new Set(['neutral', 'success', 'warning', 'offline']);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function applyAttributes(node, attributes = {}) {
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  return node;
}

export function RadicButton({ label, variant = 'primary', type = 'button', disabled = false, loading = false, ariaLabel } = {}) {
  const resolvedVariant = variants.has(variant) ? variant : 'primary';
  const button = el('button', `radic-button radic-button--${resolvedVariant}`);
  button.type = type;
  button.disabled = disabled || loading;
  if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
  if (loading) {
    button.setAttribute('aria-busy', 'true');
    button.append(el('span', 'radic-button__spinner'));
  }
  if (label) button.append(document.createTextNode(label));
  return button;
}

export function RadicInput({ id, label, type = 'text', placeholder = '', hint = '', name } = {}) {
  const wrapper = el('label', 'radic-field');
  const labelNode = el('span', 'radic-label', label ?? 'Field');
  const input = el('input', 'radic-input');
  input.type = type;
  if (id) input.id = id;
  if (name) input.name = name;
  input.placeholder = placeholder;
  wrapper.append(labelNode, input);
  if (hint) wrapper.append(el('span', 'radic-field__hint', hint));
  return wrapper;
}

export function RadicTextarea({ id, label, placeholder = '', hint = '', name } = {}) {
  const wrapper = el('label', 'radic-field');
  wrapper.append(el('span', 'radic-label', label ?? 'Details'));
  const textarea = el('textarea', 'radic-textarea');
  if (id) textarea.id = id;
  if (name) textarea.name = name;
  textarea.placeholder = placeholder;
  wrapper.append(textarea);
  if (hint) wrapper.append(el('span', 'radic-field__hint', hint));
  return wrapper;
}

export function RadicSelect({ id, label, options = [], name } = {}) {
  const wrapper = el('label', 'radic-field');
  wrapper.append(el('span', 'radic-label', label ?? 'Select'));
  const select = el('select', 'radic-select');
  if (id) select.id = id;
  if (name) select.name = name;
  for (const option of options) {
    const optionNode = el('option', '', option.label ?? option.value ?? option);
    optionNode.value = option.value ?? option;
    select.append(optionNode);
  }
  wrapper.append(select);
  return wrapper;
}

export function RadicCheckbox({ label, name, checked = false } = {}) {
  const wrapper = el('label', 'radic-choice');
  const input = el('input');
  input.type = 'checkbox';
  if (name) input.name = name;
  input.checked = checked;
  wrapper.append(input, document.createTextNode(label ?? 'Checkbox'));
  return wrapper;
}

export function RadicRadio({ label, name, value, checked = false } = {}) {
  const wrapper = el('label', 'radic-choice');
  const input = el('input');
  input.type = 'radio';
  if (name) input.name = name;
  if (value !== undefined) input.value = String(value);
  input.checked = checked;
  wrapper.append(input, document.createTextNode(label ?? 'Radio'));
  return wrapper;
}

export function RadicCard({ title, body, quiet = false } = {}) {
  const card = el('section', `radic-card${quiet ? ' radic-card--quiet' : ''}`);
  const content = el('div', 'radic-card__body');
  if (title) content.append(el('h3', '', title));
  if (body) content.append(el('p', '', body));
  card.append(content);
  return card;
}

export function RadicBadge({ label, tone = 'neutral' } = {}) {
  const resolvedTone = badgeTones.has(tone) ? tone : 'neutral';
  return el('span', `radic-badge radic-badge--${resolvedTone}`, label ?? 'Status');
}

export function RadicTabs({ tabs = [] } = {}) {
  const root = el('div', 'radic-tabs');
  const list = applyAttributes(el('div', 'radic-tab-list'), { role: 'tablist', 'aria-label': 'RadicX tabs' });
  const panels = el('div');

  tabs.forEach((tab, index) => {
    const id = `radic-tab-${index}`;
    const panelId = `radic-panel-${index}`;
    const button = applyAttributes(el('button', 'radic-tab', tab.label), {
      type: 'button',
      role: 'tab',
      id,
      'aria-controls': panelId,
      'aria-selected': index === 0 ? 'true' : 'false',
      tabindex: index === 0 ? '0' : '-1'
    });
    const panel = applyAttributes(el('section', '', tab.content ?? ''), {
      role: 'tabpanel',
      id: panelId,
      'aria-labelledby': id,
      tabindex: '0'
    });
    panel.hidden = index !== 0;
    list.append(button);
    panels.append(panel);
  });

  root.append(list, panels);
  return root;
}

export function RadicProgress({ value = 0, label = 'Progress' } = {}) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const progress = applyAttributes(el('div', 'radic-progress'), {
    role: 'progressbar',
    'aria-label': label,
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': String(clamped)
  });
  const bar = el('div', 'radic-progress__bar');
  bar.style.width = `${clamped}%`;
  progress.append(bar);
  return progress;
}

export function RadicDialog({ id = 'radic-dialog', title = 'Dialog', body = '' } = {}) {
  const dialog = el('dialog', 'radic-dialog');
  dialog.id = id;
  const content = el('div', 'radic-dialog__body');
  const header = el('div', 'radic-dialog__header');
  header.append(el('h2', '', title));
  const close = RadicButton({ label: 'Close', variant: 'ghost' });
  close.dataset.dialogClose = '';
  header.append(close);
  content.append(header, el('p', '', body));
  dialog.append(content);
  return dialog;
}

export function RadicSheet({ id = 'radic-sheet', title = 'Sheet', body = '' } = {}) {
  const sheet = el('dialog', 'radic-sheet');
  sheet.id = id;
  const content = el('div', 'radic-sheet__body');
  const header = el('div', 'radic-sheet__header');
  header.append(el('h2', '', title));
  const close = RadicButton({ label: 'Close', variant: 'ghost' });
  close.dataset.sheetClose = '';
  header.append(close);
  content.append(header, el('p', '', body));
  sheet.append(content);
  return sheet;
}

export function RadicToast({ message = 'Saved' } = {}) {
  return applyAttributes(el('div', 'radic-toast', message), { role: 'status' });
}

export function RadicTooltip({ label = 'More information', text = 'Helpful context' } = {}) {
  const wrapper = el('span', 'radic-tooltip-wrap');
  const id = `radic-tooltip-${Math.random().toString(36).slice(2)}`;
  const trigger = RadicButton({ label: '?', variant: 'icon', ariaLabel: label });
  trigger.setAttribute('aria-describedby', id);
  const tooltip = applyAttributes(el('span', 'radic-tooltip', text), { id, role: 'tooltip' });
  wrapper.append(trigger, tooltip);
  return wrapper;
}

export function RadicSkeleton({ width = '100%', height = '20px', label = 'Loading content' } = {}) {
  const skeleton = applyAttributes(el('div', 'radic-skeleton'), { role: 'status', 'aria-label': label });
  skeleton.style.width = width;
  skeleton.style.height = height;
  return skeleton;
}

export function RadicEmptyState({ title = 'Nothing here yet', body = 'Content will appear when this workflow is implemented.' } = {}) {
  const root = el('div', 'radic-empty-state');
  root.append(el('div', 'radic-empty-state__mark', 'RX'), el('h3', '', title), el('p', 'radic-supporting-text', body));
  return root;
}

export function RadicSyncState({ label = 'Online', tone = 'success' } = {}) {
  const resolvedTone = syncTones.has(tone) ? tone : 'neutral';
  const root = applyAttributes(el('span', `radic-sync-state radic-sync-state--${resolvedTone}`), { role: 'status' });
  root.append(el('span', 'radic-status-dot'), document.createTextNode(label));
  return root;
}

export function RadicStat({ label = 'Metric', value = '—', supporting = '' } = {}) {
  const root = el('div', 'radic-stat');
  root.append(el('span', 'radic-label', label), el('strong', 'radic-stat__value', value));
  if (supporting) root.append(el('span', 'radic-supporting-text', supporting));
  return root;
}

export function RadicNavigation({ items = [], ariaLabel = 'Primary navigation' } = {}) {
  const nav = applyAttributes(el('nav'), { 'aria-label': ariaLabel });
  for (const item of items) {
    const link = el('a', 'radic-nav-link', item.label);
    link.href = item.href ?? '#';
    if (item.current) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  return nav;
}

export const RadicSpecializedInterfaces = Object.freeze({
  RadicAnswerOption: { milestone: 'M6', responsibility: 'answer selection presentation contract' },
  RadicQuestion: { milestone: 'M6', responsibility: 'focused question presentation contract' },
  RadicReadiness: { milestone: 'M9', responsibility: 'readiness and evidence presentation contract' },
  RadicMomentum: { milestone: 'M9', responsibility: 'meaningful learning momentum presentation contract' },
  RadicMission: { milestone: 'M9', responsibility: 'useful mission presentation contract' },
  RadicAchievement: { milestone: 'M9', responsibility: 'achievement presentation contract' },
  RadicExamTimer: { milestone: 'M8', responsibility: 'server-authoritative exam timer presentation contract' }
});
