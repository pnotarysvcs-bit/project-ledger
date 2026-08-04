'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DASHBOARD_MONTHS } from '../../src/dashboard-months.js';

export default function MonthSelector({ selectedMonth }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(event) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', event.target.value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="month-selector-label">
      <span className="sr-only">Dashboard month</span>
      <select
        className="month-pill month-selector"
        value={selectedMonth}
        onChange={handleChange}
        aria-label="Dashboard month"
      >
        {DASHBOARD_MONTHS.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}
