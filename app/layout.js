import './styles.css';
import './bills-enhancements.css';
import './bills-hotfix.css';
import Nav from './nav.js';
import BillsFilterFix from './bills-filter-fix.js';

export const metadata = {
  title: 'Project Ledger',
  description: 'Bill status and payment overview',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <BillsFilterFix />
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
