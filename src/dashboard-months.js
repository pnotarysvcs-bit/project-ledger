export const DASHBOARD_MONTHS = Object.freeze([
  { value: '2026-04', label: 'April 2026' },
  { value: '2026-05', label: 'May 2026' },
  { value: '2026-06', label: 'June 2026' },
  { value: '2026-07', label: 'July 2026' },
  { value: '2026-08', label: 'August 2026' },
  { value: '2026-09', label: 'September 2026' },
  { value: '2026-10', label: 'October 2026' },
  { value: '2026-11', label: 'November 2026' },
  { value: '2026-12', label: 'December 2026' },
]);

const SUPPORTED_MONTHS = new Set(DASHBOARD_MONTHS.map(({ value }) => value));

export function monthValueFromDate(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function resolveDashboardMonth(requestedMonth, now = new Date()) {
  if (SUPPORTED_MONTHS.has(requestedMonth)) return requestedMonth;

  const currentMonth = monthValueFromDate(now);
  if (SUPPORTED_MONTHS.has(currentMonth)) return currentMonth;

  return DASHBOARD_MONTHS.at(-1).value;
}

export function dateForDashboardMonth(monthValue) {
  const resolvedMonth = resolveDashboardMonth(monthValue);
  return new Date(`${resolvedMonth}-01T00:00:00Z`);
}

export function labelForDashboardMonth(monthValue) {
  return DASHBOARD_MONTHS.find(({ value }) => value === monthValue)?.label
    ?? DASHBOARD_MONTHS.at(-1).label;
}
