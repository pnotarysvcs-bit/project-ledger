import { supabaseRequest } from '../../../../src/supabase-server.js';
import { billsRedirect } from '../redirect.js';

export async function POST(request) {
  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  const month = String(formData.get('month') ?? '');

  if (!id) return billsRedirect(request, month, 'Archive failed: bill id is required.');

  try {
    await supabaseRequest(`ledger_bills?id=eq.${encodeURIComponent(id)}&select=id`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: { is_active: false, archived_at: new Date().toISOString() },
    });
  } catch (error) {
    return billsRedirect(request, month, `Archive failed: ${error.message}`);
  }

  return billsRedirect(request, month);
}
