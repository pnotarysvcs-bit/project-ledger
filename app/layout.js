import './styles.css';
import './bills-enhancements.css';
import './bills-hotfix.css';
import Nav from './nav.js';

export const metadata = {
  title: 'Project Ledger',
  description: 'Bill status and payment overview',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Nav />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
