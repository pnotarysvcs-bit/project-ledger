'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseRequest } from '../../src/supabase-server.js';
import { PAY_PERIOD_LABELS } from '../../src/pay-period-data.js';

function nonNegativeNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be zero or greater.`);
  return parsed;
}

export async function savePayPeriodFinancesAction(data) {
  const month = String(data.get('month') ?? '');
  const period = Number(data.get('period'));
  const offset = Number(data.get('offset') ?? 0);
  const targetMonth = String(data.get('targetMonth') ?? '');
  if (!/^\d{4}-\d{2}$/.test(month) || ![1, 2].includes(period) || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error('Invalid pay-period values.');
  }

  await supabaseRequest('ledger_pay_period_finances?on_conflict=month,period', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: {
      month: `${month}-01`,
      period,
      regular_income: nonNegativeNumber(data.get('regularIncome'), 'Regular paycheck'),
      notary_income: nonNegativeNumber(data.get('notaryIncome'), 'Notary income'),
      ahead_contribution: nonNegativeNumber(data.get('aheadContribution'), 'One-month-ahead contribution'),
      target_month: `${targetMonth}-01`,
      updated_at: new Date().toISOString(),
    },
  });

  revalidatePath('/pay-period');
  redirect(`/pay-period?pp=${offset}&saved=1`);
}

export async function assignBillPayPeriodAction(data) {
  const billId = String(data.get('billId') ?? '');
  const assignment = String(data.get('assignment') ?? '');
  const offset = Number(data.get('offset') ?? 0);
  const allowed = ['', PAY_PERIOD_LABELS[1], PAY_PERIOD_LABELS[2]];
  if (!billId || !allowed.includes(assignment)) throw new Error('Invalid bill assignment.');

  await supabaseRequest(`ledger_bills?id=eq.${billId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: { pay_period: assignment || null, updated_at: new Date().toISOString() },
  });

  revalidatePath('/pay-period');
  revalidatePath('/');
  redirect(`/pay-period?pp=${offset}`);
}
