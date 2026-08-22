import { supabaseRequest } from './supabase-server.js';

export async function recordClosedBillRollover({ sourceBill, targetBill, closedMonth, monthlyAmount }) {
  const amount = Number(monthlyAmount);
  if (!sourceBill?.id || !Number.isFinite(amount) || amount <= 0) return null;
  const rows = await supabaseRequest('ledger_goal_rollovers?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: {
      source_bill_id: sourceBill.id,
      source_name: sourceBill.payee,
      target_bill_id: targetBill?.id ?? null,
      target_name: targetBill?.payee ?? null,
      closed_month: `${closedMonth}-01`,
      monthly_amount: amount,
      status: targetBill ? 'allocated' : 'unallocated',
    },
  });
  return rows?.[0] ?? null;
}

export async function getGoalRollovers() {
  return supabaseRequest('ledger_goal_rollovers?select=id,source_bill_id,source_name,target_bill_id,target_name,closed_month,monthly_amount,status,created_at&order=created_at.desc');
}
