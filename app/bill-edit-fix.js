'use client';

import { useEffect } from 'react';

export default function BillEditFix() {
  useEffect(() => {
    const handleSubmit = async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.id.startsWith('edit-bill-')) return;

      event.preventDefault();
      const submitter = event.submitter;
      if (submitter instanceof HTMLButtonElement) submitter.disabled = true;

      try {
        const response = await fetch('/api/bills/edit', {
          method: 'POST',
          body: new FormData(form),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Bill update failed.');
        window.location.assign(result.redirect);
      } catch (error) {
        window.alert(error.message || 'Bill update failed.');
        if (submitter instanceof HTMLButtonElement) submitter.disabled = false;
      }
    };

    document.addEventListener('submit', handleSubmit, true);
    return () => document.removeEventListener('submit', handleSubmit, true);
  }, []);

  return null;
}
