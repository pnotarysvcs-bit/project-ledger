import ReconciliationClient from './reconciliation-client.js';

export const dynamic = 'force-dynamic';

export default async function ReconciliationPage({ searchParams }) {
  const params = await searchParams;
  return <ReconciliationClient initialImportId={String(params?.import ?? '')} />;
}
