const number = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Income minus expenses for a single month, from household funding and the
// month's bill summary. Pure so it can be tested without Supabase.
export function calculateMonthlyNet(income = {}, summary = {}) {
  const householdFunding = number(income.householdFunding);
  const expenses = number(summary.total);
  const paid = number(summary.totalPaid);
  const stillToPay = Math.max(0, number(summary.remaining) + number(summary.overdue));
  const net = householdFunding - expenses;

  return {
    income: householdFunding,
    payrollIncome: number(income.payrollIncome),
    notarySupport: number(income.notarySupport),
    otherFunding: number(income.otherFunding),
    expenses,
    paid,
    stillToPay,
    net,
    shortfall: Math.max(0, -net),
    leftAfterBillsPaid: householdFunding - paid,
    covered: net >= 0,
    incompleteCount: Number(summary.incompleteCount ?? 0),
  };
}
