import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import BillingTable from './BillingTableClient';

// ─── Types ───────────────────────────────────────────────────────────────────

import type { BillingBusiness } from './BillingTableClient';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-6',
        warning && 'border-warning/40 bg-warning/5',
      )}
    >
      <p className="text-sm text-text-secondary mb-1">{label}</p>
      <p
        className={cn(
          'text-3xl font-bold',
          warning ? 'text-warning' : 'text-text-primary',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PlanBadge({ plan }: { plan: BillingBusiness['plan'] }) {
  const map: Record<BillingBusiness['plan'], string> = {
    TRIAL: 'bg-surface text-text-secondary border border-border',
    STARTER: 'bg-accent/10 text-accent',
    PRO: 'bg-success/10 text-success',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        map[plan],
      )}
    >
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: BillingBusiness['status'] }) {
  const map: Record<BillingBusiness['status'], string> = {
    ACTIVE: 'bg-success/10 text-success',
    SUSPENDED: 'bg-warning/10 text-warning',
    CANCELLED: 'bg-error/10 text-error',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        map[status],
      )}
    >
      {status}
    </span>
  );
}

// ─── Page (Server Component) ──────────────────────────────────────────────────

export default async function AdminBillingPage() {
  const session = await auth();
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/login');

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      plan: true,
      planExpiresAt: true,
      status: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const expiringCount = businesses.filter(
    (b) =>
      b.planExpiresAt &&
      b.planExpiresAt <= sevenDaysFromNow &&
      b.status === 'ACTIVE',
  ).length;

  const activePaid = businesses.filter(
    (b) => b.status === 'ACTIVE' && b.plan !== 'TRIAL',
  ).length;

  // Serialize Dates for the client boundary
  const serialized: BillingBusiness[] = businesses.map((b) => ({
    ...b,
    planExpiresAt: b.planExpiresAt ?? null,
    createdAt: b.createdAt,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Billing</h1>

      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
        <StatCard label="Active Paid" value={String(activePaid)} />
        <StatCard
          label="Expiring (7d)"
          value={String(expiringCount)}
          warning={expiringCount > 0}
        />
        <StatCard label="Total Businesses" value={String(businesses.length)} />
      </div>

      <BillingTable businesses={serialized} />
    </div>
  );
}