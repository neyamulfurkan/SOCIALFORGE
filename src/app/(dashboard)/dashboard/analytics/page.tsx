'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { formatPrice } from '@/lib/utils';

const AnalyticsCharts = dynamic(
  () => import('@/components/dashboard/AnalyticsCharts'),
  { ssr: false, loading: () => <ChartsSkeleton /> },
);

const DATE_RANGES = [
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: 'Custom', value: 'custom' },
] as const;

type DateRangeValue = (typeof DATE_RANGES)[number]['value'];

// ─────────────────────────────────────────────
// Analytics data shape — defined here so AnalyticsCharts
// can import it when FILE 070 is generated.
// ─────────────────────────────────────────────

export type RevenuePoint = {
  date: string;
  revenue: number;
};

export type OrdersPoint = {
  date: string;
  orders: number;
};

export type TopProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  revenue: number;
  maxRevenue: number; // used to compute bar width %
};

export type TrafficSource = {
  channel: string;
  count: number;
};

export type KeyMetrics = {
  conversionRate: number;
  averageOrderValue: number;
  totalCustomers: number;
  totalRevenue: number;
};

export type AnalyticsData = {
  revenueOverTime: RevenuePoint[];
  ordersOverTime: OrdersPoint[];
  topProducts: TopProduct[];
  trafficSources: TrafficSource[];
  keyMetrics: KeyMetrics;
};

// ─────────────────────────────────────────────
// Key metrics row
// ─────────────────────────────────────────────

function KeyMetricsRow({ metrics }: { metrics: KeyMetrics }) {
  const cards = [
    {
      label: 'Total Revenue',
      value: formatPrice(metrics.totalRevenue),
    },
    {
      label: 'Avg. Order Value',
      value: formatPrice(metrics.averageOrderValue),
    },
    {
      label: 'Conversion Rate',
      value: metrics.conversionRate.toFixed(1) + '%',
    },
    {
      label: 'Total Customers',
      value: metrics.totalCustomers.toLocaleString(),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-surface border border-border rounded-lg p-5"
        >
          <p className="text-text-secondary text-sm mb-1">{card.label}</p>
          <p className="text-2xl font-bold tabular-nums">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton shown while AnalyticsCharts lazy-loads
// ─────────────────────────────────────────────

function ChartsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="bg-surface border border-border rounded-lg p-6 h-64 animate-pulse"
        />
      ))}
    </div>
  );
}

function KeyMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-surface border border-border rounded-lg p-5 h-20 animate-pulse"
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;

  const [dateRange, setDateRange] = useState<DateRangeValue>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const isCustomReady =
    dateRange !== 'custom' || (customFrom.length > 0 && customTo.length > 0);

  const { data, isLoading, isError } = useQuery<{ data: AnalyticsData }>({
    queryKey: ['analytics', businessId, dateRange, customFrom, customTo],
    queryFn: async () => {
      const params = new URLSearchParams({ range: dateRange });
      if (dateRange === 'custom') {
        params.set('from', customFrom);
        params.set('to', customTo);
      }
      const res = await fetch('/api/orders/analytics?' + params.toString(), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    enabled: !!businessId && isCustomReady,
    staleTime: 300_000,
  });

  const analyticsData = data?.data ?? null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>

        {/* Date range selector */}
        <div className="flex flex-wrap gap-2">
          {DATE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' +
                (dateRange === r.value
                  ? 'bg-accent text-accent-text'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary')
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date inputs */}
      {dateRange === 'custom' && (
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-surface border border-border rounded-lg">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-secondary font-medium">
              From
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-base border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-secondary font-medium">
              To
            </label>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-base border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          {!isCustomReady && (
            <p className="self-end pb-2 text-xs text-text-tertiary">
              Select both dates to load data.
            </p>
          )}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="bg-error/10 border border-error/20 rounded-lg p-4 mb-6 text-sm text-error">
          Failed to load analytics data. Please try again.
        </div>
      )}

      {/* Key metrics */}
      {isLoading ? (
        <KeyMetricsSkeleton />
      ) : analyticsData ? (
        <KeyMetricsRow metrics={analyticsData.keyMetrics} />
      ) : null}

      {/* Charts — lazy-loaded, ssr: false */}
      <AnalyticsCharts data={analyticsData} dateRange={dateRange} />
    </div>
  );
}