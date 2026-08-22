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
        <div>
          <h1>Income &amp; Household Funding</h1>
          <p className="lede">See posted payroll, notary support, and other confirmed household funding separately so business transfers are not mistaken for salary.</p>
        </div>
        <div className="head-actions"><MonthSelector selectedMonth={selectedMonth} /></div>
      </header>
      <section className="widget-row">
        <MonthlyIncomeCard selectedMonth={selectedMonth} searchParams={params} />
      </section>
    </>
  );
}
