'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function BillsMonthSelector({ selectedMonth, options }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function changeMonth(event) {
    const query = new URLSearchParams();
    query.set('month', event.target.value);
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('f_') && value) query.set(key, value);
    }
    router.push(`/?${query.toString()}`);
  }

  return (
    <div className="month-selector">
      <label htmlFor="bills-month">Month</label>
      <select id="bills-month" name="month" value={selectedMonth} onChange={changeMonth}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
