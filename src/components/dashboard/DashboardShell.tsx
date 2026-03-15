'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { UserRole } from '@prisma/client';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  businessId: string | null;
};

type DashboardShellProps = {
  user: User;
  businessName: string;
  isImpersonating: boolean;
  children: React.ReactNode;
};

// ─────────────────────────────────────────────
// ICONS (inline SVGs — no external icon library)
// ─────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

function ShoppingBagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function MoreHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// NAV CONFIG
// ─────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
};

const BASE_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon },
  { href: '/dashboard/products', label: 'Products', Icon: BoxIcon },
  { href: '/dashboard/orders', label: 'Orders', Icon: ShoppingBagIcon },
  { href: '/dashboard/messages', label: 'Messages', Icon: MessageIcon },
  { href: '/dashboard/social', label: 'Social', Icon: ShareIcon },
  { href: '/dashboard/analytics', label: 'Analytics', Icon: ChartIcon },
  { href: '/dashboard/settings', label: 'Settings', Icon: SettingsIcon },
];

const ADMIN_NAV_ITEM: NavItem = { href: '/admin', label: 'Admin Panel', Icon: ShieldIcon };

// ─────────────────────────────────────────────
// SIDEBAR NAV ITEM
// ─────────────────────────────────────────────

function SidebarNavItem({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative group',
        'border-l-2',
        isActive
          ? 'border-accent bg-surface-raised text-text-primary'
          : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised',
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.Icon className={cn('shrink-0', isActive ? 'text-accent' : '')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {/* Tooltip for collapsed state */}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-raised text-text-primary text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-elevated">
          {item.label}
        </span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────
// MOBILE BOTTOM NAV
// ─────────────────────────────────────────────

const MOBILE_PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon },
  { href: '/dashboard/orders', label: 'Orders', Icon: ShoppingBagIcon },
  { href: '/dashboard/products', label: 'Products', Icon: BoxIcon },
  { href: '/dashboard/messages', label: 'Messages', Icon: MessageIcon },
];

function MobileBottomNav({
  navItems,
  pathname,
  onMoreClick,
}: {
  navItems: NavItem[];
  pathname: string;
  onMoreClick: () => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_PRIMARY_NAV.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                isActive ? 'text-accent' : 'text-text-secondary',
              )}
            >
              <item.Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-xs font-medium text-text-secondary"
        >
          <MoreHorizontalIcon className="w-5 h-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────
// MOBILE MORE SHEET
// ─────────────────────────────────────────────

const MOBILE_MORE_NAV: NavItem[] = [
  { href: '/dashboard/social', label: 'Social', Icon: ShareIcon },
  { href: '/dashboard/analytics', label: 'Analytics', Icon: ChartIcon },
  { href: '/dashboard/settings', label: 'Settings', Icon: SettingsIcon },
];

function MobileMoreSheet({
  open,
  onClose,
  user,
  extraNav,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  extraNav: NavItem[];
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl p-6 md:hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-text-primary">More</span>
              <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                <XIcon />
              </button>
            </div>
            <div className="flex flex-col gap-1 mb-4">
              {[...MOBILE_MORE_NAV, ...extraNav].map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'text-accent bg-surface-raised'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised',
                    )}
                  >
                    <item.Icon />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-border pt-4">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-error hover:bg-surface-raised w-full transition-colors"
              >
                <LogOutIcon />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// USER AVATAR (initials)
// ─────────────────────────────────────────────

function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'rounded-full bg-accent text-accent-text flex items-center justify-center font-semibold shrink-0',
        size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm',
      )}
    >
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function DashboardShell({
  user,
  businessName,
  isImpersonating,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const navItems: NavItem[] =
    user.role === 'SUPER_ADMIN' ? [...BASE_NAV, ADMIN_NAV_ITEM] : BASE_NAV;

  const mobileExtraNav: NavItem[] = user.role === 'SUPER_ADMIN' ? [ADMIN_NAV_ITEM] : [];

  const handleExitImpersonation = async () => {
    await fetch('/api/admin/impersonate/exit', { method: 'POST' });
    window.location.href = '/admin';
  };

  const isNavActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <div className="h-screen bg-base flex flex-col overflow-hidden">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div
          className="sticky top-0 z-50 bg-warning text-white text-center py-2 text-sm cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handleExitImpersonation}
        >
          Impersonating <strong>{businessName}</strong> — click to exit
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <motion.aside
          animate={{ width: sidebarCollapsed ? 64 : 240 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="hidden md:flex flex-col border-r border-border bg-surface shrink-0 overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {/* Sidebar header */}
          <div className="flex items-center h-14 px-3 border-b border-border shrink-0">
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="font-bold text-text-primary text-sm truncate flex-1 mr-2"
              >
                {businessName}
              </motion.span>
            )}
            <button
              onClick={toggleSidebar}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors shrink-0 ml-auto"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <motion.div
                animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronLeftIcon />
              </motion.div>
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 flex flex-col gap-0.5">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                isActive={isNavActive(item.href)}
                collapsed={sidebarCollapsed}
              />
            ))}
          </nav>

          {/* User section */}
          <div className="border-t border-border px-2 py-3 shrink-0">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-md">
                <UserAvatar name={user.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                  <p className="text-xs text-text-secondary truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  title="Sign out"
                  className="text-text-secondary hover:text-error transition-colors p-1 rounded-md hover:bg-surface-raised"
                >
                  <LogOutIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <UserAvatar name={user.name} size="sm" />
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  title="Sign out"
                  className="text-text-secondary hover:text-error transition-colors p-1.5 rounded-md hover:bg-surface-raised"
                >
                  <LogOutIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </motion.aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-border bg-surface shrink-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <MenuIcon />
            </button>
            <span className="font-semibold text-text-primary text-sm truncate max-w-[200px]">
              {businessName}
            </span>
            <UserAvatar name={user.name} size="sm" />
          </header>

          {/* Page content */}
          <main className="flex-1 min-h-0 overflow-hidden pb-20 md:pb-0 flex flex-col">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile slide-in sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
                <span className="font-bold text-text-primary">{businessName}</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  <XIcon />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors border-l-2',
                      isNavActive(item.href)
                        ? 'border-accent bg-surface-raised text-text-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised',
                    )}
                  >
                    <item.Icon className={cn('shrink-0', isNavActive(item.href) ? 'text-accent' : '')} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>

              <div className="border-t border-border px-3 py-4 shrink-0">
                <div className="flex items-center gap-2.5 px-2 py-2 rounded-md mb-2">
                  <UserAvatar name={user.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                    <p className="text-xs text-text-secondary truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-error hover:bg-surface-raised w-full transition-colors"
                >
                  <LogOutIcon />
                  <span>Sign out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile bottom navigation */}
      <MobileBottomNav
        navItems={navItems}
        pathname={pathname}
        onMoreClick={() => setMobileMoreOpen(true)}
      />

      {/* Mobile more sheet */}
      <MobileMoreSheet
        open={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        user={user}
        extraNav={mobileExtraNav}
      />
    </div>
  );
}