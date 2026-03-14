'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatPrice, formatRelativeTime, cn } from '@/lib/utils';
import type { AdminBusinessRow } from '@/lib/types';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const PLAN_OPTIONS = ['ALL', 'TRIAL', 'STARTER', 'PRO'] as const;
type PlanFilter = (typeof PLAN_OPTIONS)[number];
type SortKey = 'name' | 'createdAt' | 'orderCount' | 'totalRevenue';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success',
  SUSPENDED: 'bg-warning/10 text-warning',
  CANCELLED: 'bg-error/10 text-error',
};

const PLAN_VARIANT: Record<string, string> = {
  TRIAL: 'bg-surface text-text-secondary',
  STARTER: 'bg-accent/10 text-accent',
  PRO: 'bg-success/10 text-success',
};

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function BusinessTable({ initialRows }: { initialRows: AdminBusinessRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('ALL');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', storeName: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  async function handleCreateBusiness() {
    if (!createForm.name || !createForm.email || !createForm.password || !createForm.storeName) {
      setCreateError('All fields are required');
      return;
    }
    if (createForm.password.length < 8) {
      setCreateError('Password must be at least 8 characters');
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(res.status === 409 ? 'Email already registered' : (data.error ?? 'Failed to create business'));
        return;
      }
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', storeName: '' });
      router.refresh();
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  }

  // Use initial server data for the first page with no filters applied;
  // switch to TanStack Query fetches when filters/page change.
  const isInitialState = page === 1 && !search && planFilter === 'ALL';

  const { data: fetchedRows } = useQuery<AdminBusinessRow[]>({
    queryKey: ['admin-businesses', search, planFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        plan: planFilter === 'ALL' ? '' : planFilter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/businesses?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch businesses');
      const json = await res.json();
      return (json.data as AdminBusinessRow[]) ?? [];
    },
    initialData: isInitialState ? initialRows : undefined,
    staleTime: 30_000,
    enabled: !isInitialState,
  });

  const rows = isInitialState ? initialRows : (fetchedRows ?? []);

  // Client-side sort on already-fetched page
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortKey === 'createdAt') {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortKey === 'orderCount') {
      cmp = a.orderCount - b.orderCount;
    } else if (sortKey === 'totalRevenue') {
      cmp = a.totalRevenue - b.totalRevenue;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const handleImpersonate = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setImpersonatingId(id);
      try {
        const res = await fetch(`/api/admin/impersonate/${id}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Impersonation failed');
        const json = await res.json();
        const token: string = json.token;
        const businessId: string = json.businessId;
        document.cookie = `impersonation_token=${token}; path=/; max-age=900; SameSite=Lax`;
        document.cookie = `impersonating_business_id=${businessId}; path=/; max-age=900; SameSite=Lax`;
        router.push('/dashboard');
      } catch {
        alert('Failed to impersonate this business. Please try again.');
      } finally {
        setImpersonatingId(null);
      }
    },
    [router],
  );

  const hasMore = rows.length === PAGE_SIZE;

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Businesses</h2>
          <p className="text-sm text-text-secondary mt-1">
            All registered businesses on the platform.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:bg-accent-hover transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Add Business
        </button>
      </div>

      {/* Create Business Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md bg-surface rounded-xl p-6 shadow-elevated border border-border">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-text-primary">Add New Business</h3>
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(null); }}
                className="text-text-tertiary hover:text-text-primary transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            {createError && (
              <div className="mb-4 px-3 py-2 rounded-md bg-error/10 border border-error/20">
                <p className="text-error text-sm">{createError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Owner Full Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className={cn(
                    'w-full bg-base border border-border rounded-md px-3 py-2 text-sm',
                    'text-text-primary placeholder:text-text-tertiary',
                    'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Owner Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className={cn(
                    'w-full bg-base border border-border rounded-md px-3 py-2 text-sm',
                    'text-text-primary placeholder:text-text-tertiary',
                    'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Store Name</label>
                <input
                  type="text"
                  value={createForm.storeName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, storeName: e.target.value }))}
                  placeholder="My Awesome Shop"
                  className={cn(
                    'w-full bg-base border border-border rounded-md px-3 py-2 text-sm',
                    'text-text-primary placeholder:text-text-tertiary',
                    'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Initial Password</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  className={cn(
                    'w-full bg-base border border-border rounded-md px-3 py-2 text-sm',
                    'text-text-primary placeholder:text-text-tertiary',
                    'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(null); }}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBusiness}
                disabled={createLoading}
                className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? 'Creating…' : 'Create Business'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, slug, or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={cn(
            'flex-1 min-w-[200px] max-w-xs bg-surface border border-border rounded-md px-3 py-2',
            'text-sm text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          )}
        />
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value as PlanFilter);
            setPage(1);
          }}
          className={cn(
            'bg-surface border border-border rounded-md px-3 py-2 text-sm',
            'text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          )}
        >
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === 'ALL' ? 'All Plans' : p}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <Th onClick={() => handleSort('name')}>
                Business <SortIndicator col="name" sortKey={sortKey} sortDir={sortDir} />
              </Th>
              <Th>Plan</Th>
              <Th onClick={() => handleSort('createdAt')}>
                Signed Up <SortIndicator col="createdAt" sortKey={sortKey} sortDir={sortDir} />
              </Th>
              <Th onClick={() => handleSort('orderCount')}>
                Orders <SortIndicator col="orderCount" sortKey={sortKey} sortDir={sortDir} />
              </Th>
              <Th onClick={() => handleSort('totalRevenue')}>
                Revenue <SortIndicator col="totalRevenue" sortKey={sortKey} sortDir={sortDir} />
              </Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm text-text-secondary">
                  No businesses found.
                </td>
              </tr>
            )}
            {sorted.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/admin/businesses/${row.id}`)}
                className="border-b border-border last:border-0 hover:bg-surface-raised cursor-pointer transition-colors"
              >
                {/* Name + slug */}
                <td className="px-4 py-3">
                  <p className="font-medium text-text-primary">{row.name}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    /{row.slug}
                    {row.ownerEmail ? ` · ${row.ownerEmail}` : ''}
                  </p>
                </td>

                {/* Plan badge */}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      PLAN_VARIANT[row.plan] ?? 'bg-surface text-text-secondary',
                    )}
                  >
                    {row.plan}
                  </span>
                </td>

                {/* Signup date */}
                <td className="px-4 py-3 text-text-secondary">
                  {formatRelativeTime(new Date(row.createdAt))}
                </td>

                {/* Order count */}
                <td className="px-4 py-3 text-text-secondary tabular-nums">{row.orderCount}</td>

                {/* Revenue */}
                <td className="px-4 py-3 text-text-secondary tabular-nums">
                  {formatPrice(row.totalRevenue)}
                </td>

                {/* Status badge */}
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      STATUS_VARIANT[row.status] ?? 'bg-surface text-text-secondary',
                    )}
                  >
                    {row.status}
                  </span>
                </td>

                {/* Impersonate */}
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => handleImpersonate(e, row.id)}
                    disabled={impersonatingId === row.id}
                    className={cn(
                      'rounded-md border border-border px-3 py-1.5 text-xs font-medium',
                      'text-text-secondary hover:text-text-primary hover:bg-surface-raised',
                      'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {impersonatingId === row.id ? 'Loading…' : 'Impersonate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-text-secondary">
          Showing {sorted.length} business{sorted.length !== 1 ? 'es' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-xs font-medium',
              'text-text-secondary hover:text-text-primary hover:bg-surface-raised',
              'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            Previous
          </button>
          <span className="text-xs text-text-secondary px-1">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-xs font-medium',
              'text-text-secondary hover:text-text-primary hover:bg-surface-raised',
              'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SMALL HELPERS — used only in this file
// ─────────────────────────────────────────────

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide',
        onClick && 'cursor-pointer select-none hover:text-text-primary transition-colors',
      )}
    >
      {children}
    </th>
  );
}

function SortIndicator({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (sortKey !== col) {
    return <span className="ml-1 text-text-tertiary">↕</span>;
  }
  return <span className="ml-1 text-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}