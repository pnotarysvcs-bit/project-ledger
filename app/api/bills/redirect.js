function normalizeMonth(value) {
  if (/^\d{4}-\d{2}$/.test(value ?? '')) return value;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function billsRedirect(request, month, message = null, hash = '') {
  const safeMonth = normalizeMonth(month);
  const url = new URL('/', request.url);
  url.searchParams.set('month', safeMonth);
  if (message) url.searchParams.set('actionError', message);
  if (hash) url.hash = hash;
  return Response.redirect(url, 303);
}
