'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pay-period', label: 'Pay Period' },
  { href: '/', label: 'Bills' },
  { href: '/income', label: 'Income' },
  { href: '/dashboard#goals', label: 'Goals' },
  { href: '/reconcile', label: 'Reports' },
  { href: '/accounts', label: 'Accounts' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="ledger-topbar platform-topbar">
      <Link className="ledger-brand" href="/dashboard">
        <span className="ledger-mark" aria-hidden="true">$</span>
        <strong>PROJECT LEDGER</strong>
      </Link>

      <nav aria-label="Project Ledger sections">
        {LINKS.map(({ href, label }) => {
          const basePath = href.split('#')[0];
          const active = label !== 'Goals' && pathname === basePath;
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

      <div className="ledger-user" aria-label="Current user">
        <span aria-hidden="true">♧</span>
        <span className="user-avatar">KF</span>
        <span>Kim</span>
        <span aria-hidden="true">⌄</span>
      </div>
    </header>
  );
}
