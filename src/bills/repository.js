import { supabaseRequest } from '../supabase-server.js';

export function createBillsRepository(request = supabaseRequest) {
  return {
    async getMasterBill(id) {
      const rows = await request(`ledger_bills?select=id,bill_name,bill_type,category,account,budget,frequency,due_day,recurrence_anchor,start_month,notes,is_active,archived_at&id=eq.${encodeURIComponent(id)}`);
      return rows?.[0] ?? null;
    },

    async createMasterBill(payload) {
      const rows = await request('ledger_bills?select=id', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: payload,
      });
      return rows?.[0] ?? null;
    },

    async updateMasterBill(id, patch) {
      if (!Object.keys(patch).length) return;
      await request(`ledger_bills?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
    },

    async getOccurrence({ billId, occurrenceId, month, dueDate }) {
      if (occurrenceId) {
        const rows = await request(`ledger_bill_months?select=id,bill_id,month,occurrence_budget_amount,actual_amount,due_date,installment_key,migration_incomplete&id=eq.${encodeURIComponent(occurrenceId)}&bill_id=eq.${encodeURIComponent(billId)}&month=eq.${month}-01`);
        if (rows?.[0]) return rows[0];
      }
      if (dueDate) {
        const rows = await request(`ledger_bill_months?select=id,bill_id,month,occurrence_budget_amount,actual_amount,due_date,installment_key,migration_incomplete&bill_id=eq.${encodeURIComponent(billId)}&month=eq.${month}-01&due_date=eq.${dueDate}`);
        if (rows?.[0]) return rows[0];
      }
      return null;
    },

    async createOccurrence(payload) {
      const rows = await request('ledger_bill_months?select=id', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: payload,
      });
      return rows?.[0] ?? null;
    },

    async updateOccurrence({ billId, occurrenceId, month }, patch) {
      if (!Object.keys(patch).length) return;
      await request(`ledger_bill_months?id=eq.${encodeURIComponent(occurrenceId)}&bill_id=eq.${encodeURIComponent(billId)}&month=eq.${month}-01`, { method: 'PATCH', body: patch });
    },

    async addPayment(payload) {
      const rows = await request('ledger_bill_payments?select=id', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: payload,
      });
      return rows?.[0] ?? null;
    },

    async addPayments(payloads) {
      if (!payloads.length) return [];
      const rows = await request('ledger_bill_payments?select=id', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: payloads,
      });
      return rows ?? [];
    },

    async updatePayment({ billId, occurrenceId, paymentId, month }, patch) {
      await request(`ledger_bill_payments?id=eq.${encodeURIComponent(paymentId)}&bill_id=eq.${encodeURIComponent(billId)}&occurrence_id=eq.${encodeURIComponent(occurrenceId)}&payment_month=eq.${month}-01`, { method: 'PATCH', body: patch });
    },

    async removePayment({ billId, occurrenceId, paymentId, month, reason = 'Undo Submitted' }) {
      await request('rpc/project_ledger_reverse_payment', {
        method: 'POST',
        body: {
          p_payment_id: paymentId,
          p_bill_id: billId,
          p_payment_month: `${month}-01`,
          p_occurrence_id: occurrenceId || null,
          p_reason: reason,
        },
      });
    },

    async archiveBill(id, archivedAt = new Date().toISOString()) {
      await request(`ledger_bills?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { is_active: false, archived_at: archivedAt },
      });
    },
  };
}

export const billsRepository = createBillsRepository();
