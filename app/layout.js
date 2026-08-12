import './styles.css';
import './bills-enhancements.css';
import './bills-hotfix.css';
import Nav from './nav.js';
import BillsFilterFix from './bills-filter-fix.js';
import MonthAutoSubmit from './month-auto-submit.js';
import BillEditFix from './bill-edit-fix.js';

export const metadata = {
  title: 'Project Ledger',
  description: 'Bill status and payment overview',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <BillsFilterFix />
        <MonthAutoSubmit />
        <BillEditFix />
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
