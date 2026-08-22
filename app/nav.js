'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/', label: 'Bills' },
  { href: '/pay-period', label: 'Pay Period' },
  { href: '/reconcile', label: 'Statements' },
  { href: '/accounts', label: 'Accounts' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-brand">
          <span className="app-brand__eyebrow">Financial Management</span>
          <strong>Project Ledger</strong>
        </div>
        <nav className="app-nav" aria-label="Sections">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={active ? 'active' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
