import { supabaseRequest } from '../../../../src/supabase-server.js';
import { billsRedirect } from '../redirect.js';

export async function POST(request) {
  const formData = await request.formData();
  const id = String(formData.get('id') ?? '');
  const month = String(formData.get('month') ?? '');
  const amount = Number(formData.get('amount'));

  if (!id) return billsRedirect(request, month, 'Submit failed: bill id is required.');
  if (!Number.isFinite(amount) || amount <= 0) {
    return billsRedirect(request, month, 'Submit failed: enter a bill amount before submitting payment.');
  }

  try {
    await supabaseRequest('ledger_bill_payments?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: {
        bill_id: id,
        amount,
        payment_month: `${/^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)}-01`,
        payment_date: new Date().toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    return billsRedirect(request, month, `Submit failed: ${error.message}`);
  }

  return billsRedirect(request, month);
}
