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
    <nav className="sidebar" aria-label="Sections">
      <div className="brand">
        <strong>Project Ledger</strong>
        <small>Financial Management</small>
      </div>
      <ul>
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
