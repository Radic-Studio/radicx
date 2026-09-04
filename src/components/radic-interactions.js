import { RadicToast } from './radic-components.js';

function safeShowModal(dialog) {
  if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
}

function safeClose(dialog) {
  if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
}

export function initRadicDialogs(root = document) {
  root.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-dialog-open]');
    if (openTrigger) {
      const target = root.querySelector(`#${CSS.escape(openTrigger.dataset.dialogOpen)}`);
      safeShowModal(target);
      return;
    }

    const closeTrigger = event.target.closest('[data-dialog-close]');
    if (closeTrigger) safeClose(closeTrigger.closest('dialog'));
  });
}

export function initRadicSheets(root = document) {
  root.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-sheet-open]');
    if (openTrigger) {
      const target = root.querySelector(`#${CSS.escape(openTrigger.dataset.sheetOpen)}`);
      safeShowModal(target);
      return;
    }

    const closeTrigger = event.target.closest('[data-sheet-close]');
    if (closeTrigger) safeClose(closeTrigger.closest('dialog'));
  });
}

export function initRadicTabs(root = document) {
  for (const list of root.querySelectorAll('[role="tablist"]')) {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    if (!tabs.length) continue;

    function activateTab(nextTab, focus = true) {
      for (const tab of tabs) {
        const selected = tab === nextTab;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        const panelId = tab.getAttribute('aria-controls');
        const panel = panelId ? root.getElementById?.(panelId) ?? root.querySelector(`#${CSS.escape(panelId)}`) : null;
        if (panel) panel.hidden = !selected;
      }
      if (focus) nextTab.focus();
    }

    list.addEventListener('click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab && tabs.includes(tab)) activateTab(tab, false);
    });

    list.addEventListener('keydown', (event) => {
      const currentIndex = tabs.indexOf(document.activeElement);
      if (currentIndex < 0) return;
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[nextIndex]);
    });
  }
}

export function initRadicToasts(root = document) {
  const region = root.querySelector('[data-toast-region]');
  if (!region) return;

  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-toast-message]');
    if (!trigger) return;
    const toast = RadicToast({ message: trigger.dataset.toastMessage });
    region.append(toast);
    window.setTimeout(() => toast.remove(), 3200);
  });
}

export function initMobileNavigation(root = document) {
  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-mobile-menu]');
    if (!trigger) return;
    const target = root.querySelector(`#${CSS.escape(trigger.dataset.mobileMenu)}`);
    safeShowModal(target);
  });
}

export function initRadicInteractions(root = document) {
  initRadicDialogs(root);
  initRadicSheets(root);
  initRadicTabs(root);
  initRadicToasts(root);
  initMobileNavigation(root);
}
