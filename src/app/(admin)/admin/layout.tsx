import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Businesses' },
  { href: '/admin/settings', label: 'Global Settings' },
  { href: '/admin/feature-flags', label: 'Feature Flags' },
  { href: '/admin/billing', label: 'Billing' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-base flex">
      <aside className="w-60 border-r border-border flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="font-bold text-lg text-text-primary">Admin Panel</h1>
          <p className="text-xs text-text-secondary mt-0.5">Platform Operator</p>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block px-3 py-2 rounded-md text-sm text-text-secondary',
                'hover:text-text-primary hover:bg-surface-raised transition-colors',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-xs text-text-tertiary truncate">{session.user.email}</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}