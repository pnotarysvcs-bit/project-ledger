import { supabaseRequest } from './supabase-server.js';

export async function closeBillWithRollover({ sourceBill, targetBill, closedMonth, monthlyAmount }) {
  const amount = Number(monthlyAmount);
  if (!sourceBill?.id || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Closed bill rollover details are invalid.');
  }

  return supabaseRequest('rpc/close_ledger_bill_with_rollover', {
    method: 'POST',
    body: {
      p_source_bill_id: sourceBill.id,
      p_source_name: sourceBill.payee,
      p_target_bill_id: targetBill?.id ?? null,
      p_target_name: targetBill?.payee ?? null,
      p_closed_month: `${closedMonth}-01`,
      p_monthly_amount: amount,
    },
  });
}

export async function getGoalRollovers() {
  return supabaseRequest('ledger_goal_rollovers?select=id,source_bill_id,source_name,target_bill_id,target_name,closed_month,monthly_amount,status,created_at&order=created_at.desc');
}
