/**
 * Due-date engine.
 *
 * `manual_bills` stores a cadence, not a date: `due_day` (day of the month),
 * `frequency`, and `start_month`. A concrete due date only exists relative to a
 * period, which is why `bill_payments` is keyed by `period_month`. This module
 * turns a bill plus a period into the dates it actually falls due.
 *
 * Everything is UTC and date-only. Local time zones would shift a bill across a
 * month boundary and silently move it into the wrong period.
 */

export const FREQUENCIES = ['monthly', 'quarterly', 'annual', 'bi_weekly', 'one_time', 'custom'];

/** Cadences with no fixed rule. They need a per-bill schedule we do not hold. */
export const UNSUPPORTED_FREQUENCIES = ['custom'];

const MONTHS_PER_PERIOD = { monthly: 1, quarterly: 3, annual: 12 };
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const BI_WEEKLY_DAYS = 14;

function parseDate(value) {
  if (value == null) throw new TypeError('A date is required');

  const text = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);

  // Accept a bare "YYYY-MM" period as the first of that month.
  const normalized = /^\d{4}-\d{2}$/.test(String(value)) ? `${value}-01` : text;
  const date = new Date(`${normalized}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid date: ${value}`);
  return date;
}

const toISO = (date) => date.toISOString().slice(0, 10);

/** Days in a UTC month. Day 0 of the next month is the last day of this one. */
export function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Place a day-of-month inside a given month.
 *
 * A bill due on the 31st still falls due in February; it lands on the last day
 * rather than rolling into March.
 */
export function clampDayToMonth(day, year, monthIndex) {
  const last = daysInMonth(year, monthIndex);
  return Math.min(Math.max(Math.trunc(day), 1), last);
}

function wholeMonthsBetween(from, to) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12
    + (to.getUTCMonth() - from.getUTCMonth());
}

/** True once the period reaches the month the bill starts in. */
export function isActiveInPeriod(bill, periodMonth) {
  return wholeMonthsBetween(parseDate(bill.start_month), parseDate(periodMonth)) >= 0;
}

function biWeeklyDatesIn(bill, period) {
  const anchor = parseDate(bill.start_month);
  const year = period.getUTCFullYear();
  const monthIndex = period.getUTCMonth();
  const monthEnd = Date.UTC(year, monthIndex, daysInMonth(year, monthIndex));

  const dates = [];
  // Step forward from the anchor rather than back from the period, so the
  // fortnightly rhythm stays tied to the date the bill actually started.
  for (let time = anchor.getTime(); time <= monthEnd; time += BI_WEEKLY_DAYS * DAY_IN_MS) {
    const date = new Date(time);
    if (date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex) {
      dates.push(toISO(date));
    }
  }

  return dates;
}

/**
 * Every date the bill falls due within `periodMonth`.
 *
 * Usually none or one. A fortnightly bill can fall due three times in a month,
 * which is why this returns a list rather than a single date.
 */
export function dueDatesInPeriod(bill, periodMonth) {
  if (UNSUPPORTED_FREQUENCIES.includes(bill.frequency)) return [];
  if (bill.active === false) return [];
  if (!isActiveInPeriod(bill, periodMonth)) return [];

  const start = parseDate(bill.start_month);
  const period = parseDate(periodMonth);
  const elapsed = wholeMonthsBetween(start, period);

  if (bill.frequency === 'bi_weekly') return biWeeklyDatesIn(bill, period);

  if (bill.frequency === 'one_time') {
    if (elapsed !== 0) return [];
  } else {
    const step = MONTHS_PER_PERIOD[bill.frequency];
    if (!step || elapsed % step !== 0) return [];
  }

  const year = period.getUTCFullYear();
  const monthIndex = period.getUTCMonth();
  return [toISO(new Date(Date.UTC(year, monthIndex, clampDayToMonth(bill.due_day, year, monthIndex))))];
}

/** The single due date for a period, or null. Fortnightly bills yield the first. */
export function dueDateInPeriod(bill, periodMonth) {
  return dueDatesInPeriod(bill, periodMonth)[0] ?? null;
}

/**
 * The next date the bill falls due on or after `asOf`.
 *
 * Searches forward a bounded number of months so an annual bill is still found,
 * and a bill that can never fall due returns null instead of looping.
 */
export function nextDueDate(bill, { asOf = new Date(), horizonMonths = 24 } = {}) {
  const today = parseDate(asOf);

  for (let offset = 0; offset <= horizonMonths; offset += 1) {
    const period = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
    const upcoming = dueDatesInPeriod(bill, toISO(period))
      .filter((date) => parseDate(date) >= today);

    if (upcoming.length > 0) return upcoming[0];
  }

  return null;
}
