'use client';

import { useEffect } from 'react';

export default function MonthAutoSubmit() {
  useEffect(() => {
    const select = document.getElementById('bills-month');
    if (!select) return undefined;

    const form = select.closest('form');
    if (!form) return undefined;

    form.querySelector("button[type='submit']")?.remove();

    const handleChange = () => {
      form.submit();
    };

    select.addEventListener('change', handleChange);
    return () => select.removeEventListener('change', handleChange);
  }, []);

  return null;
}
