'use client';

import { useEffect } from 'react';

function enhanceSubmittedActions() {
  if (window.location.pathname !== '/') return;

  for (const row of document.querySelectorAll('tr')) {
    if (!row.querySelector('.status.submitted')) continue;

    const form = [...row.querySelectorAll('form')].find((candidate) => {
      const button = candidate.querySelector('button[type="submit"]');
      return button && (button.textContent.trim() === 'Submit' || button.dataset.undoSubmitted === 'true');
    });
    if (!form) continue;

    const button = form.querySelector('button[type="submit"]');
    if (!button) continue;

    button.disabled = false;
    button.textContent = 'Undo Submitted';
    button.dataset.undoSubmitted = 'true';
    button.classList.add('undo-submitted');

    let flag = form.querySelector('input[name="undoSubmitted"]');
    if (!flag) {
      flag = document.createElement('input');
      flag.type = 'hidden';
      flag.name = 'undoSubmitted';
      form.appendChild(flag);
    }
    flag.value = 'yes';
  }
}

export default function BillsActionEnhancer() {
  useEffect(() => {
    enhanceSubmittedActions();
    const observer = new MutationObserver(enhanceSubmittedActions);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
