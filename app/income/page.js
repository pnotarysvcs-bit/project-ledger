import { resolveDashboardMonth } from '../../src/dashboard-months.js';
import MonthSelector from '../dashboard/month-selector.js';
import MonthlyIncomeCard from '../dashboard/monthly-income-card.js';

export const dynamic = 'force-dynamic';

export default async function IncomePage({ searchParams }) {
  const params = await searchParams;
  const selectedMonth = resolveDashboardMonth(params?.month, new Date());

  return (
    <>
      <header className="page-head">
        <div><h1>Income</h1><p className="lede">Add income to the selected month without changing bills, payments, budget, or credits.</p></div>
        <div className="head-actions"><MonthSelector selectedMonth={selectedMonth} /></div>
      </header>
      <section className="widget-row">
        <MonthlyIncomeCard selectedMonth={selectedMonth} searchParams={params} />
      </section>
    </>
  );
}
