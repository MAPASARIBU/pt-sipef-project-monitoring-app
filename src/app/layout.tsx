import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import Link from 'next/link';
import LogoutButton from './LogoutButton';

import { readDb } from '@/lib/db';

export const metadata: Metadata = {
  title: 'PT Sipef - Project Monitoring',
  description: 'Project Monitoring System for PT Sipef Operations',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const authUser = cookieStore.get('auth')?.value;
  
  let isAdmin = false;
  if (authUser === 'admin') {
    isAdmin = true;
  } else if (authUser) {
    const db = readDb();
    const user = db.users.find(u => u.name === authUser);
    if (user) {
      const role = db.roles.find(r => r.id === user.roleId);
      if (role && (role.accessLevel === 'admin' || role.name === 'Administrator')) {
        isAdmin = true;
      }
    }
  }

  return (
    <html lang="en">
      <body>
        <nav className="sidebar">
          <div className="sidebar-logo">
            <img src="/logo_ai.png" alt="SIPEF Logo" style={{ height: '32px', objectFit: 'contain', background: 'white', padding: '4px', borderRadius: '4px' }} />
            PT Sipef
          </div>
          <nav className="sidebar-nav">
            <Link href="/" className="nav-link">Dashboard</Link>
            <div style={{ padding: '0.5rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operational</div>
            <Link href="/initiation" className="nav-link">1. Initiation</Link>
            <Link href="/tender" className="nav-link">2A. Doc Submission</Link>
            <Link href="/tender-execution" className="nav-link">2B. Tender Batch</Link>
            <Link href="/psd-execution" className="nav-link">2C. PSD Execution</Link>
            <Link href="/contract" className="nav-link">3. Contract</Link>
            <Link href="/progress" className="nav-link">4. Progress</Link>
            <div style={{ padding: '0.5rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Settings</div>
            <Link href="/master-data" className="nav-link">Master Data</Link>
            {isAdmin && (
              <Link href="/users" className="nav-link">Master Management</Link>
            )}
          </nav>
          <LogoutButton />
        </nav>
        <main className="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
