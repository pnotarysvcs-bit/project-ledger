import { supabaseRequest } from '../../../../src/supabase-server.js';
import { billsRedirect } from '../redirect.js';

export async function POST(request) {
  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  const month = String(formData.get('month') ?? '');
  const budget = Number(formData.get('budget'));
  const hash = id ? `bill-${id}` : '';

  if (!id) return billsRedirect(request, month, 'Edit failed: bill id is required.');
  if (!Number.isFinite(budget) || budget <= 0) {
    return billsRedirect(request, month, 'Edit failed: enter a positive bill amount.', hash);
  }

  try {
    await supabaseRequest(`ledger_bills?id=eq.${encodeURIComponent(id)}&select=id,budget`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: { budget },
    });
  } catch (error) {
    return billsRedirect(request, month, `Edit failed: ${error.message}`, hash);
  }

  return billsRedirect(request, month, null, hash);
}
