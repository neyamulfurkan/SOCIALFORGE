'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatPrice } from '@/lib/utils';
import type {
  AnalyticsData,
  RevenuePoint,
  OrdersPoint,
  TopProduct,
  TrafficSource,
  KeyMetrics,
} from '@/app/(dashboard)/dashboard/analytics/page';

// Re-export types so FILE 047's instruction_for_FILE_070 note is honoured —
// consumers of this file can import the types from either location.
export type {
  AnalyticsData,
  RevenuePoint,
  OrdersPoint,
  TopProduct,
  TrafficSource,
  KeyMetrics,
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

type Props = {
  data: AnalyticsData | null;
  dateRange: string;
};

// ─────────────────────────────────────────────
// Custom Tooltip
// ─────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 2 }}>
        {label}
      </p>
      <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
        {formatter(payload[0].value)}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────

function ChartSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state inside a chart area
// ─────────────────────────────────────────────

function ChartEmpty({ message = 'No data for this period' }: { message?: string }) {
  return (
    <div
      style={{ height: 240 }}
      className="flex items-center justify-center text-text-secondary text-sm"
    >
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// Revenue over time — LineChart
// ─────────────────────────────────────────────

function RevenueChart({ points }: { points: RevenuePoint[] }) {
  if (!points.length) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.15} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => '৳' + v.toLocaleString()}
          width={70}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as Array<{ value: number }>}
              label={label as string}
              formatter={(v) => formatPrice(v)}
            />
          )}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={points.length === 1 ? { r: 4, fill: 'var(--color-accent)' } : false}
          activeDot={{ r: 5, fill: 'var(--color-accent)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────
// Orders over time — BarChart
// ─────────────────────────────────────────────

function OrdersChart({ points }: { points: OrdersPoint[] }) {
  if (!points.length) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltip
              active={active}
              payload={payload as Array<{ value: number }>}
              label={label as string}
              formatter={(v) => v + ' orders'}
            />
          )}
        />
        <Bar
          dataKey="orders"
          fill="var(--color-accent)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────
// Top products — sorted list with relative bar
// ─────────────────────────────────────────────

function TopProductsList({ products }: { products: TopProduct[] }) {
  if (!products.length) {
    return (
      <p className="text-text-secondary text-sm py-4 text-center">
        No orders in this period
      </p>
    );
  }

  const maxRevenue = Math.max(...products.map((p) => p.revenue), 1);

  return (
    <ul className="space-y-3">
      {products.map((product) => (
        <li key={product.id} className="flex items-center gap-3">
          {/* Thumbnail */}
          <div className="w-10 h-10 rounded-md overflow-hidden bg-surface-raised flex-shrink-0">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-border" />
            )}
          </div>

          {/* Name + bar */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{product.name}</p>
            <div className="mt-1 h-1 w-full bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{
                  width: ((product.revenue / maxRevenue) * 100).toFixed(1) + '%',
                }}
              />
            </div>
          </div>

          {/* Revenue */}
          <p className="text-sm font-semibold tabular-nums flex-shrink-0 text-text-primary">
            {formatPrice(product.revenue)}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────
// Traffic sources — horizontal bar list
// ─────────────────────────────────────────────

function TrafficSourcesList({ sources }: { sources: TrafficSource[] }) {
  if (!sources.length) {
    return (
      <p className="text-text-secondary text-sm py-4 text-center">
        No traffic data for this period
      </p>
    );
  }

  const maxCount = Math.max(...sources.map((s) => s.count), 1);
  const total = sources.reduce((sum, s) => sum + s.count, 0);

  return (
    <ul className="space-y-3">
      {sources.map((source) => (
        <li key={source.channel} className="flex items-center gap-3">
          <p className="text-sm text-text-secondary w-20 flex-shrink-0 capitalize">
            {source.channel.toLowerCase()}
          </p>
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{
                width: ((source.count / maxCount) * 100).toFixed(1) + '%',
              }}
            />
          </div>
          <p className="text-sm tabular-nums text-text-secondary flex-shrink-0 w-16 text-right">
            {total > 0 ? ((source.count / total) * 100).toFixed(0) + '%' : '0%'}
            <span className="text-text-tertiary ml-1">({source.count})</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────
// Skeleton for each chart while data loads
// ─────────────────────────────────────────────

function SkeletonChart() {
  return (
    <div className="h-60 bg-surface-raised rounded-md animate-pulse" />
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-surface-raised animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-surface-raised rounded animate-pulse w-3/4" />
            <div className="h-1 bg-surface-raised rounded animate-pulse" />
          </div>
          <div className="w-16 h-3 bg-surface-raised rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export default function AnalyticsCharts({ data, dateRange }: Props) {
  const isNull = data === null;

  return (
    <div className="space-y-6">
      {/* Revenue over time */}
      <ChartSection title="Revenue Over Time">
        {isNull ? (
          <SkeletonChart />
        ) : (
          <RevenueChart points={data.revenueOverTime} />
        )}
      </ChartSection>

      {/* Orders over time */}
      <ChartSection title="Orders Over Time">
        {isNull ? (
          <SkeletonChart />
        ) : (
          <OrdersChart points={data.ordersOverTime} />
        )}
      </ChartSection>

      {/* Bottom row: top products + traffic sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSection title="Top Products by Revenue">
          {isNull ? <SkeletonList /> : <TopProductsList products={data.topProducts} />}
        </ChartSection>

        <ChartSection title="Traffic Sources">
          {isNull ? <SkeletonList /> : <TrafficSourcesList sources={data.trafficSources} />}
        </ChartSection>
      </div>
    </div>
  );
}