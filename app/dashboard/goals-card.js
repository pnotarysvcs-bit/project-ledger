import { buildFinancialGoals } from '../../src/goals.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = (current, target) => target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

export default function GoalsCard({ rows = [] }) {
  const goals = buildFinancialGoals({ rows });
  const expensePercent = goals.actualExpenses.current > goals.actualExpenses.target
    ? Math.max(0, Math.round((goals.actualExpenses.target / goals.actualExpenses.current) * 100))
    : 100;
  const emergencyPercent = percent(goals.emergencyFund.current, goals.emergencyFund.target);
  const monthAheadPercent = percent(goals.oneMonthAhead.current, goals.oneMonthAhead.target);

  return (
    <article className="widget">
      <header><strong>Goals &amp; Financial Runway</strong><span className="status partial">Live</span></header>
      <p className="muted"><b>Current priority:</b> {goals.currentPriority.name}</p>
      <ul className="goals">
        <li>
          <span className="goal-head"><b>Actual Monthly Expenses</b><small>{money.format(goals.actualExpenses.current)} / {money.format(goals.actualExpenses.target)}</small></span>
          <span className="goal-bar"><span className="progress-track"><span className="progress-fill blue" style={{ width: `${expensePercent}%` }} /></span><small>{goals.actualExpenses.missingActualCount ? `${goals.actualExpenses.missingActualCount} missing actual` : goals.actualExpenses.remainingToCut ? `${money.format(goals.actualExpenses.remainingToCut)} to cut` : 'Target met'}</small></span>
        </li>
        <li>
          <span className="goal-head"><b>Emergency Fund</b><small>{money.format(goals.emergencyFund.current)} / {money.format(goals.emergencyFund.target)}</small></span>
          <span className="goal-bar"><span className="progress-track"><span className="progress-fill green" style={{ width: `${emergencyPercent}%` }} /></span><small>{emergencyPercent}%</small></span>
        </li>
        <li>
          <span className="goal-head"><b>One Month Ahead</b><small>{money.format(goals.oneMonthAhead.current)} / {money.format(goals.oneMonthAhead.target)}</small></span>
          <span className="goal-bar"><span className="progress-track"><span className="progress-fill purple" style={{ width: `${monthAheadPercent}%` }} /></span><small>{monthAheadPercent}%</small></span>
        </li>
      </ul>
      <footer className="muted">Emergency Fund and One Month Ahead remain at $0 until a real funding source is wired. No sample balances are used.</footer>
    </article>
  );
}
