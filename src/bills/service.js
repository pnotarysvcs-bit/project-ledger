import { deriveBillType, invalidBillCategory } from './domain.js';
import { billsRepository } from './repository.js';

function numberOrNull(value, label) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be zero or greater.`);
  return parsed;
}

function positiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be greater than zero.`);
  return parsed;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
}

function validMonth(value) {
  return /^\d{4}-\d{2}$/.test(String(value ?? ''));
}

function validateBillIdentity({ id, month, name, account, category, dueDate, requireCategory = false, validateCategory = true }) {
  if (id !== undefined && !String(id).trim()) throw new Error('Bill id is required.');
  if (!validMonth(month)) throw new Error('A valid month is required.');
  if (!String(name ?? '').trim() || !String(account ?? '').trim()) throw new Error('Bill name and Account are required.');
  if (requireCategory && !String(category ?? '').trim()) throw new Error('Category is required.');
  if (validateCategory && category && invalidBillCategory(category)) throw new Error('Business and Personal are Types, not Categories. Choose a bill category.');
  if (!validDate(dueDate)) throw new Error('A valid Due Date is required.');
}

function validateUpdatedCategory(category, currentCategory) {
  if (!category || !invalidBillCategory(category)) return;
  const normalizedIncoming = String(category).trim().toLowerCase();
  const normalizedCurrent = String(currentCategory ?? '').trim().toLowerCase();
  if (normalizedIncoming === normalizedCurrent && invalidBillCategory(currentCategory)) return;
  throw new Error('Business and Personal are Types, not Categories. Choose a bill category.');
}

function validateBillType(account, requestedType) {
  const billType = deriveBillType(account, requestedType);
  if (!['Personal', 'Business', 'Streaming', 'Capital One'].includes(billType)) throw new Error('Choose a valid Type.');
  return billType;
}

export async function createBill(input, repository = billsRepository) {
  const month = String(input.month ?? '').trim();
  const name = String(input.name ?? '').trim();
  const category = String(input.category ?? '').trim();
  const account = String(input.account ?? '').trim().toUpperCase();
  const frequency = String(input.frequency ?? 'monthly').trim();
  const requestedType = String(input.type ?? '').trim();
  const dueDate = String(input.nextDue ?? '').trim();
  const budget = numberOrNull(input.budget, 'Budget Amount');
  const actualAmount = numberOrNull(input.actualAmount, 'Actual Bill Amount');

  validateBillIdentity({ month, name, account, category, dueDate, requireCategory: true });
  if (budget === null && actualAmount === null) throw new Error('Enter either a Budget Amount or an Actual Bill Amount.');
  const billType = validateBillType(account, requestedType);

  const master = await repository.createMasterBill({
    bill_name: name,
    bill_type: billType,
    category,
    account,
    budget,
    frequency,
    due_day: Number(dueDate.slice(8, 10)),
    recurrence_anchor: frequency === 'bi-weekly' ? dueDate : null,
    start_month: `${month}-01`,
    is_active: true,
    notes: String(input.notes ?? '').trim() || null,
  });
  if (!master?.id) throw new Error('Bill creation was not confirmed by the database.');

  const occurrence = await repository.createOccurrence({
    bill_id: master.id,
    month: `${month}-01`,
    status: null,
    occurrence_budget_amount: budget,
    actual_amount: actualAmount,
    due_date: dueDate,
    installment_key: dueDate,
    migration_incomplete: false,
  });
  if (!occurrence?.id) throw new Error('Bill occurrence creation was not confirmed by the database.');

  return { billId: master.id, occurrenceId: occurrence.id };
}

export async function updateBill(input, repository = billsRepository) {
  const id = String(input.id ?? '').trim();
  const month = String(input.month ?? '').trim();
  const name = String(input.name ?? '').trim();
  const category = String(input.category ?? '').trim();
  const account = String(input.account ?? '').trim().toUpperCase();
  const frequency = String(input.frequency ?? '').trim();
  const requestedType = String(input.type ?? '').trim();
  const dueDate = String(input.nextDue ?? '').trim();
  const budget = numberOrNull(input.budget, 'Budget Amount');
  const actualAmount = numberOrNull(input.actualAmount, 'Actual Bill Amount');

  validateBillIdentity({ id, month, name, account, category, dueDate, validateCategory: false });

  const master = await repository.getMasterBill(id);
  if (!master) throw new Error('The selected bill was not found. Refresh and try again.');
  validateUpdatedCategory(category, master.category);

  const billType = validateBillType(account, requestedType);
  const masterBudget = master.budget === null || master.budget === undefined ? null : Number(master.budget);
  const dueDay = Number(dueDate.slice(8, 10));
  const recurrenceAnchor = frequency === 'bi-weekly' ? dueDate : null;
  const masterPatch = {};
  if (name !== master.bill_name) masterPatch.bill_name = name;
  if (billType !== master.bill_type) masterPatch.bill_type = billType;
  if (category && category !== master.category) masterPatch.category = category;
  if (account !== master.account) masterPatch.account = account;
  if (frequency && frequency !== master.frequency) masterPatch.frequency = frequency;
  if (budget !== masterBudget) masterPatch.budget = budget;
  if (dueDay !== Number(master.due_day)) masterPatch.due_day = dueDay;
  if (recurrenceAnchor !== (master.recurrence_anchor ?? null)) masterPatch.recurrence_anchor = recurrenceAnchor;
  await repository.updateMasterBill(id, masterPatch);

  let occurrence = await repository.getOccurrence({
    billId: id,
    occurrenceId: String(input.occurrenceId ?? '').trim(),
    month,
    dueDate,
  });

  if (!occurrence) {
    occurrence = await repository.createOccurrence({
      bill_id: id,
      month: `${month}-01`,
      status: null,
      occurrence_budget_amount: budget,
      actual_amount: actualAmount,
      due_date: dueDate,
      installment_key: dueDate,
      migration_incomplete: false,
    });
    if (!occurrence?.id) throw new Error('Bill occurrence creation was not confirmed by the database.');
  } else {
    const currentActual = occurrence.actual_amount == null ? null : Number(occurrence.actual_amount);
    const occurrencePatch = {};
    if (actualAmount !== currentActual) occurrencePatch.actual_amount = actualAmount;
    if (Object.keys(occurrencePatch).length) {
      occurrencePatch.migration_incomplete = false;
      await repository.updateOccurrence({ billId: id, occurrenceId: occurrence.id, month }, occurrencePatch);
    }
  }

  return { billId: id, occurrenceId: occurrence.id, masterPatch };
}

export async function recordPayment(input, repository = billsRepository) {
  const billId = String(input.id ?? '').trim();
  const occurrenceId = String(input.occurrenceId ?? '').trim();
  const month = String(input.month ?? '').trim();
  const dueDate = String(input.dueDate ?? '').trim();
  const paymentDate = String(input.paymentDate ?? '').trim();
  const fundingAccount = String(input.fundingAccount ?? '').trim();
  const amount = positiveNumber(input.amount, 'Payment Amount');

  if (!billId) throw new Error('Bill id is required.');
  if (!validMonth(month)) throw new Error('A valid month is required.');
  if (!validDate(paymentDate)) throw new Error('A valid payment date is required.');
  if (!fundingAccount) throw new Error('Funding account is required.');

  const occurrence = await repository.getOccurrence({ billId, occurrenceId, month, dueDate });
  if (!occurrence) throw new Error('The selected bill occurrence was not found. Refresh and try again.');

  const payment = await repository.addPayment({
    bill_id: billId,
    occurrence_id: occurrence.id,
    amount,
    payment_month: `${month}-01`,
    payment_date: paymentDate,
    funding_account: fundingAccount,
    notes: String(input.notes ?? '').trim() || null,
  });
  return { billId, occurrenceId: occurrence.id, paymentId: payment?.id ?? null };
}

export async function recordBulkPayments(input, repository = billsRepository) {
  const month = String(input.month ?? '').trim();
  const currentMonth = String(input.currentMonth ?? '').trim();
  if (!validMonth(month) || !validMonth(currentMonth)) throw new Error('A valid month is required.');
  if (month >= currentMonth) throw new Error('Bulk Submit is available only for previous months.');

  const eligible = (input.bills ?? []).filter((bill) => bill.occurrenceId && bill.effectiveAmount !== null && bill.remaining > 0);
  const payloads = eligible.map((bill) => ({
    bill_id: bill.id,
    occurrence_id: bill.occurrenceId,
    amount: bill.remaining,
    payment_month: `${month}-01`,
    payment_date: bill.nextDue,
    funding_account: bill.account,
    notes: 'Bulk payment submitted',
  }));
  await repository.addPayments(payloads);
  return { count: payloads.length };
}

export async function changePayment(input, repository = billsRepository) {
  const billId = String(input.id ?? '').trim();
  const occurrenceId = String(input.occurrenceId ?? '').trim();
  const paymentId = String(input.paymentId ?? '').trim();
  const month = String(input.month ?? '').trim();
  const paymentDate = String(input.paymentDate ?? '').trim();
  const fundingAccount = String(input.fundingAccount ?? '').trim();
  const amount = positiveNumber(input.amount, 'Payment Amount');

  if (!billId || !occurrenceId || !paymentId) throw new Error('Payment, occurrence, and bill identifiers are required.');
  if (!validMonth(month)) throw new Error('A valid month is required.');
  if (!validDate(paymentDate)) throw new Error('A valid payment date is required.');
  if (!fundingAccount) throw new Error('Funding account is required.');

  await repository.updatePayment({ billId, occurrenceId, paymentId, month }, {
    amount,
    payment_date: paymentDate,
    funding_account: fundingAccount,
    notes: String(input.notes ?? '').trim() || null,
  });
  return { billId, occurrenceId, paymentId };
}

export async function deletePayment(input, repository = billsRepository) {
  const billId = String(input.id ?? '').trim();
  const occurrenceId = String(input.occurrenceId ?? '').trim();
  const paymentId = String(input.paymentId ?? '').trim();
  const month = String(input.month ?? '').trim();
  if (!billId || !paymentId) throw new Error('Payment and bill identifiers are required.');
  if (!validMonth(month)) throw new Error('A valid month is required.');
  await repository.removePayment({ billId, occurrenceId, paymentId, month });
  return { billId, occurrenceId: occurrenceId || null, paymentId };
}

export async function archiveBill(input, repository = billsRepository) {
  const id = String(input.id ?? '').trim();
  if (!id) throw new Error('Bill id is required.');
  await repository.archiveBill(id, input.archivedAt);
  return { billId: id };
}
