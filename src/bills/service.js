import { deriveBillType, invalidBillCategory } from './domain.js';
import { billsRepository } from './repository.js';

function numberOrNull(value, label) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be zero or greater.`);
  return parsed;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
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

  if (!id) throw new Error('Bill id is required.');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('A valid month is required.');
  if (!name || !account) throw new Error('Bill name and Account are required.');
  if (category && invalidBillCategory(category)) throw new Error('Business and Personal are Types, not Categories. Choose a bill category.');
  if (!validDate(dueDate)) throw new Error('A valid Next Due date is required.');

  const master = await repository.getMasterBill(id);
  if (!master) throw new Error('The selected bill was not found. Refresh and try again.');

  const billType = deriveBillType(account, requestedType);
  if (!['Personal', 'Business', 'Streaming'].includes(billType)) throw new Error('Choose a valid Type.');

  const masterPatch = {};
  if (name !== master.bill_name) masterPatch.bill_name = name;
  if (billType !== master.bill_type) masterPatch.bill_type = billType;
  if (category && category !== master.category) masterPatch.category = category;
  if (account !== master.account) masterPatch.account = account;
  if (frequency && frequency !== master.frequency) masterPatch.frequency = frequency;
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
    const currentBudget = occurrence.occurrence_budget_amount == null ? null : Number(occurrence.occurrence_budget_amount);
    const currentActual = occurrence.actual_amount == null ? null : Number(occurrence.actual_amount);
    const occurrencePatch = {};
    if (budget !== currentBudget) occurrencePatch.occurrence_budget_amount = budget;
    if (actualAmount !== currentActual) occurrencePatch.actual_amount = actualAmount;
    if (dueDate !== occurrence.due_date) {
      occurrencePatch.due_date = dueDate;
      occurrencePatch.installment_key = dueDate;
    }
    if (Object.keys(occurrencePatch).length) {
      occurrencePatch.migration_incomplete = false;
      await repository.updateOccurrence({ billId: id, occurrenceId: occurrence.id, month }, occurrencePatch);
    }
  }

  return { billId: id, occurrenceId: occurrence.id, masterPatch };
}
