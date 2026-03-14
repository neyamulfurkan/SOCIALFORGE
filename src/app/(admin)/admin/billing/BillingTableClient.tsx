'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export type BillingBusiness = {
  id: string;
  name: string;
  plan: 'TRIAL' | 'STARTER' | 'PRO';
  planExpiresAt: Date | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  createdAt: Date;
};

function isExpiringSoon(b: BillingBusiness): boolean {
  if (!b.planExpiresAt || b.status !== 'ACTIVE') return false;
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return b.planExpiresAt <= sevenDaysFromNow;
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

function ActionButton({
  label,
  onClick,
  disabled,
  variant,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: 'primary' | 'ghost' | 'danger' | 'success';
}) {
  const variantClasses = {
    primary: 'bg-accent text-accent-text hover:bg-accent-hover',
    ghost: 'border border-border text-text-secondary hover:text-text-primary hover:bg-surface-raised',
    danger: 'bg-error/10 text-error hover:bg-error/20',
    success: 'bg-success/10 text-success hover:bg-success/20',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
      )}
    >
      {label}
    </button>
  );
}

export default function BillingTable({
  businesses,
}: {
  businesses: BillingBusiness[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function callPlanApi(businessId: string, body: Record<string, unknown>) {
    setLoading(businessId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(null);
    }
  }

  async function callStatusApi(businessId: string, body: Record<string, unknown>) {
    setLoading(businessId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Business</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Plan</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Expiry</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Created</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => {
              const expiring = isExpiringSoon(b);
              const isBusy = loading === b.id;
              return (
                <tr
                  key={b.id}
                  className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{b.name}</td>
                  <td className="px-4 py-3"><PlanBadge plan={b.plan} /></td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">
                    {b.planExpiresAt ? (
                      <span className={cn('text-sm', expiring ? 'font-semibold text-warning' : 'text-text-secondary')}>
                        {expiring && '⚠ '}{formatRelativeTime(b.planExpiresAt)}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatRelativeTime(b.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {b.status === 'SUSPENDED' ? (
                        <ActionButton label="Reactivate" disabled={isBusy} variant="success" onClick={() => callStatusApi(b.id, { status: 'ACTIVE' })} />
                      ) : (
                        <>
                          {b.plan !== 'PRO' && (
                            <ActionButton label="Upgrade" disabled={isBusy} variant="primary" onClick={() => callPlanApi(b.id, { plan: b.plan === 'TRIAL' ? 'STARTER' : 'PRO' })} />
                          )}
                          {b.plan !== 'TRIAL' && (
                            <ActionButton label="Downgrade" disabled={isBusy} variant="ghost" onClick={() => callPlanApi(b.id, { plan: b.plan === 'PRO' ? 'STARTER' : 'TRIAL' })} />
                          )}
                          <ActionButton label="Extend +7d" disabled={isBusy} variant="ghost" onClick={() => callPlanApi(b.id, { extendDays: 7 })} />
                          <ActionButton
                            label="Credit"
                            disabled={isBusy}
                            variant="ghost"
                            onClick={() => {
                              const days = parseInt(window.prompt('Credit how many days?', '30') ?? '0', 10);
                              if (days > 0) callPlanApi(b.id, { extendDays: days });
                            }}
                          />
                          {b.status === 'ACTIVE' && (
                            <ActionButton label="Pause" disabled={isBusy} variant="danger" onClick={() => callStatusApi(b.id, { status: 'SUSPENDED' })} />
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {businesses.length === 0 && (
          <div className="py-12 text-center text-text-secondary text-sm">
            No businesses registered yet.
          </div>
        )}
      </div>
    </div>
  );
}