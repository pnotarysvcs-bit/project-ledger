import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client.
 *
 * Every ledger table has RLS enabled and no policies, so an anon key reads
 * nothing. Reads therefore run on the server with the service role key, which
 * bypasses RLS and never reaches the browser. Neither variable carries the
 * NEXT_PUBLIC_ prefix, which is what keeps the key out of the client bundle.
 */

const URL_VAR = 'SUPABASE_URL';
const KEY_VAR = 'SUPABASE_SERVICE_ROLE_KEY';

let cached = null;

export function isConfigured() {
  return Boolean(process.env[URL_VAR] && process.env[KEY_VAR]);
}

/** The configured client, or null when the environment is not set up. */
export function getSupabase() {
  if (!isConfigured()) return null;

  cached ??= createClient(process.env[URL_VAR], process.env[KEY_VAR], {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}

/** Names only — used to tell the reader what is missing, never the values. */
export function missingEnvVars() {
  return [URL_VAR, KEY_VAR].filter((name) => !process.env[name]);
}
