function findEnvironmentValue(names, suffix) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }

  const match = Object.entries(process.env).find(([name, value]) =>
    Boolean(value) && name.toUpperCase().endsWith(suffix),
  );

  return match?.[1];
}

function getConfig() {
  const url = findEnvironmentValue(
    ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
    '_SUPABASE_URL',
  );
  const key = findEnvironmentValue(
    ['SUPABASE_SERVICE_ROLE_KEY', 'Project_ledger_SUPABASE_SERVICE_ROLE_KEY'],
    '_SUPABASE_SERVICE_ROLE_KEY',
  );

  if (!url || !key) {
    const missing = [!url && 'Supabase URL', !key && 'Supabase service role key']
      .filter(Boolean)
      .join(' and ');
    throw new Error(`${missing} is missing from the server environment.`);
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
