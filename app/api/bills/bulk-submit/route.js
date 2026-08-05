import { supabaseRequest } from '../../../../src/supabase-server.js';
import { billsRedirect } from '../redirect.js';

export async function POST(request) {
  const formData = await request.formData();
  const month = String(formData.get('month') ?? '');
  const ids = formData.getAll('id').map(String);
  const amounts = formData.getAll('amount').map(Number);
  const paymentMonth = `${/^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)}-01`;
  const paymentDate = new Date().toISOString().slice(0, 10);
  const payments = ids
    .map((id, index) => ({ id, amount: amounts[index] }))
    .filter(({ id, amount }) => id && Number.isFinite(amount) && amount > 0)
    .map(({ id, amount }) => ({
      bill_id: id,
      amount,
      payment_month: paymentMonth,
      payment_date: paymentDate,
    }));

  if (payments.length === 0) {
    return billsRedirect(request, month, 'Bulk submit failed: no payable bills were selected.');
  }

  try {
    await supabaseRequest('ledger_bill_payments?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: payments,
    });
  } catch (error) {
    return billsRedirect(request, month, `Bulk submit failed: ${error.message}`);
  }

  return billsRedirect(request, month);
}
