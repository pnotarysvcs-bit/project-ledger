const BLANK_TOKENS = new Set(['blank', 'empty', '(blank)']);

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function wantsBlank(needle) {
  return BLANK_TOKENS.has(normalized(needle));
}

function includesValue(value, needle) {
  if (!needle) return true;
  if (wantsBlank(needle)) return isBlank(value);
  return normalized(value).includes(normalized(needle));
}

function exactValue(value, needle) {
  if (!needle) return true;
  if (wantsBlank(needle)) return isBlank(value);
  return normalized(value) === normalized(needle);
}

function moneyValue(value, needle, formatter) {
  if (!needle) return true;
  if (wantsBlank(needle)) return isBlank(value);
  if (isBlank(value)) return false;
  return includesValue(value, needle) || includesValue(formatter.format(value), needle);
}

export function getBillFilters(params) {
  return {
    bill: String(params?.f_bill ?? '').trim(),
    type: String(params?.f_type ?? '').trim(),
    category: String(params?.f_category ?? '').trim(),
    account: String(params?.f_account ?? '').trim(),
    budget: String(params?.f_budget ?? '').trim(),
    actual: String(params?.f_actual ?? '').trim(),
    due: String(params?.f_due ?? '').trim(),
    status: String(params?.f_status ?? '').trim(),
  };
}

export function billFilterQuery(filters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(`f_${key}`, value);
  return query.toString();
}

export function applyBillFilters(rows, filters, { moneyFormatter, displayDate, displayCategory }) {
  return rows.filter((bill) => includesValue(bill.payee, filters.bill)
    && exactValue(bill.type, filters.type)
    && (wantsBlank(filters.category)
      ? isBlank(bill.category)
      : includesValue(displayCategory(bill.category), filters.category))
    && exactValue(bill.account, filters.account)
    && moneyValue(bill.budget, filters.budget, moneyFormatter)
    && moneyValue(bill.actualAmount, filters.actual, moneyFormatter)
    && (wantsBlank(filters.due)
      ? isBlank(bill.nextDue)
      : (includesValue(bill.nextDue, filters.due) || includesValue(displayDate(bill.nextDue), filters.due)))
    && exactValue(bill.status, filters.status));
}
