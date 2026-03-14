'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/uiStore';
import OrderPanel from '@/components/dashboard/OrderPanel';
import {
  STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  CHANNEL_LABELS,
} from '@/lib/constants';
import { formatPrice, formatRelativeTime, cn } from '@/lib/utils';

// ─── Inline type for order rows (OrderPanel not yet generated) ───────────────
type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number | string;
  paymentMethod: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  channel: string;
  createdAt: string;
};

type OrdersApiResponse = {
  data: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

import { StatusBadge } from '@/components/ui/Badge';

// ─── Channel icon ─────────────────────────────────────────────────────────────
function ChannelIcon({ channel }: { channel: string }) {
  const icons: Record<string, string> = {
    WEBSITE: '🌐',
    MESSENGER: '💬',
    MANUAL: '✏️',
  };
  return (
    <span title={CHANNEL_LABELS[channel] ?? channel} className="text-base">
      {icons[channel] ?? '—'}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function OrdersSkeleton() {
  return (
    <div className="bg-surface rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {['Order', 'Customer', 'Total', 'Payment', 'Status', 'Channel', 'Date'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-sm text-text-secondary font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {Array.from({ length: 7 }).map((__, j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-4 bg-surface-raised rounded animate-pulse w-24" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Order row ───────────────────────────────────────────────────────────────
function OrderRow({ order, onClick }: { order: OrderRow; onClick: () => void }) {
  const total = Number(order.total);

  return (
    <tr
      onClick={onClick}
      className="border-b border-border last:border-0 hover:bg-surface-raised cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm font-medium text-text-primary">
        #{order.orderNumber}
      </td>
      <td className="px-4 py-3 text-sm text-text-primary">{order.customerName}</td>
      <td className="px-4 py-3 text-sm text-text-primary tabular-nums">
        {formatPrice(total)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge
          status={order.paymentStatus}
          className=""
        />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={order.fulfillmentStatus} />
      </td>
      <td className="px-4 py-3">
        <ChannelIcon channel={order.channel} />
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {formatRelativeTime(new Date(order.createdAt))}
      </td>
    </tr>
  );
}



import { toast } from '@/components/ui/Toast';

// ─── Filters type ─────────────────────────────────────────────────────────────
type Filters = {
  status: string;
  paymentStatus: string;
  channel: string;
  search: string;
  page: number;
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;
  const { setActiveOrderId } = useUIStore();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<Filters>({
    status: '',
    paymentStatus: '',
    channel: '',
    search: '',
    page: 1,
  });

  function setFilter(key: keyof Filters, value: string | number) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  function setPage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  const queryKey = ['orders', businessId, filters] as const;

  const { data, isLoading, isError } = useQuery<OrdersApiResponse>({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
      if (filters.channel) params.set('channel', filters.channel);
      if (filters.search) params.set('search', filters.search);
      params.set('page', String(filters.page));
      params.set('pageSize', '20');
      const res = await fetch('/api/orders?' + params.toString(), {
        credentials: 'include',
        signal,
      });
      if (!res.ok) {
        toast.error('Failed to load orders');
        throw new Error('Failed to load orders');
      }
      return res.json();
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const orders = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const currentPage = filters.page;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Orders</h1>
          {!isLoading && (
            <p className="text-sm text-text-secondary mt-0.5">
              {total} order{total !== 1 ? 's' : ''} total
            </p>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-6 flex-wrap items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by name or order #"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className={cn(
            'bg-surface border border-border rounded-md px-3 py-2 text-sm',
            'text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
            'w-56',
          )}
        />

        {/* Fulfillment status */}
        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className={cn(
            'bg-surface border border-border rounded-md px-3 py-2 text-sm',
            'text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          )}
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {/* Payment status */}
        <select
          value={filters.paymentStatus}
          onChange={(e) => setFilter('paymentStatus', e.target.value)}
          className={cn(
            'bg-surface border border-border rounded-md px-3 py-2 text-sm',
            'text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          )}
        >
          <option value="">All Payments</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>

        {/* Channel */}
        <select
          value={filters.channel}
          onChange={(e) => setFilter('channel', e.target.value)}
          className={cn(
            'bg-surface border border-border rounded-md px-3 py-2 text-sm',
            'text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          )}
        >
          <option value="">All Channels</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(filters.status || filters.paymentStatus || filters.channel || filters.search) && (
          <button
            onClick={() =>
              setFilters({ status: '', paymentStatus: '', channel: '', search: '', page: 1 })
            }
            className="text-sm text-text-secondary hover:text-text-primary transition-colors underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {isError ? (
        <div className="bg-surface rounded-lg p-12 text-center text-text-secondary text-sm">
          Failed to load orders.{' '}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey })}
            className="text-accent hover:underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <OrdersSkeleton />
      ) : orders.length === 0 ? (
        <div className="bg-surface rounded-lg p-16 text-center">
          <div className="text-4xl mb-4">📦</div>
          <p className="text-text-primary font-medium mb-1">No orders found</p>
          <p className="text-text-secondary text-sm">
            {filters.status || filters.channel || filters.search
              ? 'Try adjusting your filters.'
              : "Orders placed via your store will appear here."}
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Order', 'Customer', 'Total', 'Payment', 'Status', 'Channel', 'Date'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-sm text-text-secondary font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onClick={() => setActiveOrderId(order.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && orders.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text-secondary">
            Page {currentPage} · {orders.length} of {total} orders
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium border border-border transition-colors',
                currentPage <= 1
                  ? 'opacity-50 cursor-not-allowed text-text-tertiary'
                  : 'text-text-primary hover:bg-surface-raised',
              )}
            >
              Previous
            </button>
            <button
              disabled={!hasMore}
              onClick={() => setPage(currentPage + 1)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium border border-border transition-colors',
                !hasMore
                  ? 'opacity-50 cursor-not-allowed text-text-tertiary'
                  : 'text-text-primary hover:bg-surface-raised',
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Order detail panel */}
      <OrderPanel />
    </div>
  );
}