/** Load the active bank accounts saved by the accounts API. */
export async function fetchActiveAccounts(fetcher = fetch) {
  const response = await fetcher('/api/accounts', { cache: 'no-store' });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? 'The accounts could not be loaded.');
  }

  return Array.isArray(data.accounts) ? data.accounts : [];
}
