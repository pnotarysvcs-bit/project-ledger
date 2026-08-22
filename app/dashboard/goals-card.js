import { buildFinancialGoals } from '../../src/goals.js';
import { getGoalRollovers } from '../../src/goals-store.js';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = (current, target) => target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

function GoalProgress({ label, current, target, tone, detail }) {
  const value = percent(current, target);
  return (
    <li className={`runway-goal ${tone}`}>
      <span className="goal-head"><b>{label}</b><small>{money.format(current)} / {money.format(target)}</small></span>
      <span className="goal-bar"><span className="progress-track"><span className={`progress-fill ${tone}`} style={{ width: `${value}%` }} /></span><small>{value}%</small></span>
      {detail ? <small className="goal-detail">{detail}</small> : null}
    </li>
  );
}

function TimelineStep({ number, label, target, state, tone, percentValue }) {
  return (
    <li className={`timeline-step ${state} ${tone}`}>
      <span className="timeline-marker">{state === 'complete' ? '✓' : number}</span>
      <span className="timeline-copy"><b>{label}</b><small>{target}</small></span>
      <span className={`timeline-status ${state}`}>{state === 'complete' ? 'Completed' : state === 'active' ? 'In progress' : 'Up next'}</span>
      <strong className="timeline-percent">{percentValue}%</strong>
    </li>
  );
}

export default async function GoalsCard({ rows = [] }) {
  let rollovers = [];
  try { rollovers = await getGoalRollovers(); } catch { rollovers = []; }

  const activeRollovers = rollovers.filter((row) => row.status !== 'completed');
  const freedMonthlyCash = activeRollovers.reduce((sum, row) => sum + Number(row.monthly_amount ?? 0), 0);
  const latestAllocation = activeRollovers.find((row) => row.status === 'allocated' && row.target_name);
  const goals = buildFinancialGoals({ rows, freedMonthlyCash });
  const expensePercent = goals.actualExpenses.current > 0
    ? Math.min(100, Math.round((goals.actualExpenses.target / goals.actualExpenses.current) * 100))
    : 0;
  const emergencyPercent = percent(goals.emergencyFund.current, goals.emergencyFund.target);
  const monthAheadPercent = percent(goals.oneMonthAhead.current, goals.oneMonthAhead.target);
  const expensesComplete = goals.actualExpenses.missingActualCount === 0 && goals.actualExpenses.remainingToCut === 0;
  const emergencyComplete = goals.emergencyFund.complete;
  const nextAllocation = latestAllocation?.target_name || (goals.currentPriority.id === 'emergency-fund' ? 'Emergency Fund' : goals.currentPriority.name);

  return (
    <section className="goals-dashboard" aria-label="Goals and financial runway">
      <article className="widget runway-card">
        <header><strong>Goals &amp; Financial Runway</strong><span className="goal-live">Live</span></header>
        <p className="muted"><b>Current priority:</b> <span className="goal-priority">{goals.currentPriority.name}</span></p>

        <div className="rolling-cash-card">
          <span className="rolling-icon" aria-hidden="true">↻</span>
          <span><small>Rolling monthly cash</small><strong>{money.format(goals.freedMonthlyCash)}</strong></span>
          <span className="rolling-divider" aria-hidden="true" />
          <span><small>Applied to</small><b>{nextAllocation}</b></span>
        </div>

        <ul className="goals runway-goals">
          <li className="runway-goal green">
            <span className="goal-head"><b>Actual Monthly Expenses</b><small>{money.format(goals.actualExpenses.current)} / {money.format(goals.actualExpenses.target)}</small></span>
            <span className="goal-bar"><span className="progress-track"><span className="progress-fill green" style={{ width: `${expensePercent}%` }} /></span><small>{expensePercent}%</small></span>
            <small className="goal-detail">{goals.actualExpenses.missingActualCount ? `${goals.actualExpenses.missingActualCount} actual amount${goals.actualExpenses.missingActualCount === 1 ? '' : 's'} still needed` : goals.actualExpenses.remainingToCut ? `${money.format(goals.actualExpenses.remainingToCut)} still to cut` : 'On track — monthly target met'}</small>
          </li>
          <GoalProgress label="Emergency Fund" current={goals.emergencyFund.current} target={goals.emergencyFund.target} tone="orange" detail={`${money.format(goals.emergencyFund.remaining)} to go`} />
          <GoalProgress label="One Month Ahead" current={goals.oneMonthAhead.current} target={goals.oneMonthAhead.target} tone="blue" detail={`${money.format(goals.oneMonthAhead.remaining)} to go`} />
        </ul>

        <div className="next-goal-callout">
          <span className="target-icon" aria-hidden="true">◎</span>
          <span><b>Next Up: {emergencyComplete ? 'One Month Ahead' : 'Emergency Fund'}</b><small>{emergencyComplete ? 'Your rolling cash will move into the one-month-ahead buffer.' : `Build the first ${money.format(goals.emergencyFund.target)} cash reserve, then redirect the same rolling cash forward.`}</small></span>
        </div>
      </article>

      <article className="widget timeline-card">
        <header><strong>Goal Timeline</strong><span className="goal-live">August plan</span></header>
        <ol className="goal-timeline">
          <TimelineStep number="1" label="Complete Actual Expenses" target={`Target: ${money.format(goals.actualExpenses.target)}/mo`} state={expensesComplete ? 'complete' : 'active'} tone="green" percentValue={expensePercent} />
          <TimelineStep number="2" label="Build Emergency Fund" target={`Target: ${money.format(goals.emergencyFund.target)}`} state={emergencyComplete ? 'complete' : expensesComplete ? 'active' : 'upcoming'} tone="orange" percentValue={emergencyPercent} />
          <TimelineStep number="3" label="Build One Month Ahead" target={`Target: ${money.format(goals.oneMonthAhead.target)}`} state={emergencyComplete ? 'active' : 'upcoming'} tone="blue" percentValue={monthAheadPercent} />
          <TimelineStep number="4" label="Next Payoff Target" target={latestAllocation?.target_name || 'Suggested when runway milestones are ready'} state="upcoming" tone="purple" percentValue={0} />
        </ol>
        <div className="timeline-note"><span aria-hidden="true">◉</span><span><b>When a goal is completed</b><small>The rolling monthly cash stays in motion and is redirected to the next financial priority.</small></span></div>
      </article>

      <article className="widget rolling-action-card">
        <header><strong>Rolling Cash in Action</strong><span className="goal-live">Live</span></header>
        <div className="rolling-action-grid">
          <span className="rolling-action-copy"><b>Closed bills increase monthly cash flow.</b><small>That money remains assigned to the next goal instead of disappearing into general spending.</small></span>
          <span className="rolling-metric"><small>Monthly Cash Added</small><strong>{money.format(goals.freedMonthlyCash)}</strong><small>from closed bills</small></span>
          <span className="rolling-arrow" aria-hidden="true">→</span>
          <span className="rolling-metric orange"><small>Currently Applied To</small><strong>{nextAllocation}</strong></span>
        </div>
      </article>

      <article className="widget glance-card">
        <header><strong>At a Glance</strong><span className="muted">August financial position</span></header>
        <div className="glance-grid">
          <div className="glance-item green"><small>Actual Monthly Expenses</small><strong>{money.format(goals.actualExpenses.current)}</strong><span>{expensePercent}% of target</span></div>
          <div className="glance-item orange"><small>Emergency Fund</small><strong>{money.format(goals.emergencyFund.current)}</strong><span>of {money.format(goals.emergencyFund.target)}</span></div>
          <div className="glance-item blue"><small>One Month Ahead</small><strong>{money.format(goals.oneMonthAhead.current)}</strong><span>of {money.format(goals.oneMonthAhead.target)}</span></div>
          <div className="glance-item purple"><small>Rolling Monthly Cash</small><strong>{money.format(goals.freedMonthlyCash)}</strong><span>{nextAllocation}</span></div>
        </div>
        <footer className="goal-footer-note">Every closed obligation should create more momentum toward the next financial objective.</footer>
      </article>
    </section>
  );
}
