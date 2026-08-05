function getConfig() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_URL_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const missingGroups = [];

    if (!url) {
      missingGroups.push(
        'Supabase URL (SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, or NEXT_PUBLIC_SUPABASE_URL_SUPABASE_URL)',
      );
    }

    if (!key) {
      missingGroups.push(
        'Supabase service role key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL_SUPABASE_SERVICE_ROLE_KEY)',
      );
    }

    throw new Error(
      `Supabase server configuration is missing: ${missingGroups.join('; ')}.`,
    );
  }

  return { url: url.replace(/\/$/, ''), key };
}

export async function supabaseRequest(path, options = {}) {
  const { url, key } = getConfig();
  const { method = 'GET', body, headers = {}, cache = 'no-store' } = options;

  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    cache,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
