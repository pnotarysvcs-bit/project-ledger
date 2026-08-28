const number = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Income minus expenses for a single month, from household funding and the
// month's bill summary. Pure so it can be tested without Supabase.
export function calculateMonthlyNet(income = {}, summary = {}) {
  const totalIncome = number(income.totalIncome);
  const expenses = number(summary.total);
  const paid = number(summary.totalPaid);
  const stillToPay = Math.max(0, number(summary.remaining) + number(summary.overdue));
  const net = totalIncome - expenses;

  return {
    income: totalIncome,
    paychecks: number(income.paychecks),
    notarySupport: number(income.notarySupport),
    expenses,
    paid,
    stillToPay,
    net,
    shortfall: Math.max(0, -net),
    leftAfterBillsPaid: totalIncome - paid,
    covered: net >= 0,
    incompleteCount: Number(summary.incompleteCount ?? 0),
  };
}
