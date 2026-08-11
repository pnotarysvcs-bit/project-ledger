'use client';

import { useEffect } from 'react';

export default function MonthAutoSubmit() {
  useEffect(() => {
    const select = document.getElementById('bills-month');
    if (!select) return undefined;

    const form = select.closest('form');
    if (!form) return undefined;

    const handleChange = () => {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    };

    select.addEventListener('change', handleChange);
    return () => select.removeEventListener('change', handleChange);
  }, []);

  return null;
}
