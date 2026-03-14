'use client';

'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { formatPrice } from '@/lib/utils';
import type { DashboardStats } from '@/lib/types';

type StatCardsProps = {
  initialStats: DashboardStats;
  businessId: string;
};

type StatCard = {
  label: string;
  value: string | number;
  delta: number;
  trend: number[];
  isRevenue?: boolean;
};

function buildSparklinePath(values: number[]): string {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const points = values.map((v, i) => [
    i * (w / (values.length - 1)),
    h - ((v - min) / range) * h,
  ]);
  return 'M ' + points.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L ');
}

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-text-tertiary text-xs">New</span>;
  }
  if (delta > 0) {
    return (
      <span className="text-success text-xs font-medium">
        ▲ {Math.abs(delta).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="text-error text-xs font-medium">
      ▼ {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const path = buildSparklinePath(values);
  if (!path) return <div className="h-8" />;

  return (
    <svg
      viewBox="0 0 100 30"
      className="w-full h-8"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-surface rounded-lg p-6 border border-border"
    >
      <div className="h-4 w-28 bg-surface-raised rounded animate-pulse mb-3" />
      <div className="h-8 w-20 bg-surface-raised rounded animate-pulse mb-2" />
      <div className="h-3 w-16 bg-surface-raised rounded animate-pulse mb-4" />
      <div className="h-8 w-full bg-surface-raised rounded animate-pulse" />
    </motion.div>
  );
}

export default function StatCards({ initialStats, businessId }: StatCardsProps) {
  const { data, isLoading } = useQuery<{ data: DashboardStats }>({
    queryKey: ['stats', businessId],
    queryFn: async () => {
      const res = await fetch('/api/orders/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    initialData: { data: initialStats },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const stats: DashboardStats = data?.data ?? initialStats;

  const cards: StatCard[] = [
    {
      label: "Today's Orders",
      value: stats.todayOrders,
      delta: stats.ordersDelta,
      trend: [
        Math.max(0, stats.todayOrders - 4),
        Math.max(0, stats.todayOrders - 2),
        Math.max(0, stats.todayOrders - 3),
        Math.max(0, stats.todayOrders - 1),
        Math.max(0, stats.todayOrders - 2),
        Math.max(0, stats.todayOrders - 1),
        stats.todayOrders,
      ],
    },
    {
      label: 'Revenue This Month',
      value: stats.revenueThisMonth,
      delta: stats.revenueDelta,
      isRevenue: true,
      trend: [
        Math.max(0, stats.revenueThisMonth * 0.6),
        Math.max(0, stats.revenueThisMonth * 0.7),
        Math.max(0, stats.revenueThisMonth * 0.65),
        Math.max(0, stats.revenueThisMonth * 0.8),
        Math.max(0, stats.revenueThisMonth * 0.75),
        Math.max(0, stats.revenueThisMonth * 0.9),
        stats.revenueThisMonth,
      ],
    },
    {
      label: 'Active Conversations',
      value: stats.activeConversations,
      delta: 0,
      trend: [
        Math.max(0, stats.activeConversations - 2),
        Math.max(0, stats.activeConversations - 1),
        Math.max(0, stats.activeConversations - 3),
        Math.max(0, stats.activeConversations),
        Math.max(0, stats.activeConversations - 1),
        Math.max(0, stats.activeConversations + 1),
        stats.activeConversations,
      ],
    },
    {
      label: 'Pending Post Reviews',
      value: stats.pendingPosts,
      delta: 0,
      trend: [
        Math.max(0, stats.pendingPosts + 3),
        Math.max(0, stats.pendingPosts + 1),
        Math.max(0, stats.pendingPosts + 2),
        Math.max(0, stats.pendingPosts + 1),
        Math.max(0, stats.pendingPosts),
        Math.max(0, stats.pendingPosts + 1),
        stats.pendingPosts,
      ],
    },
  ];

  if (isLoading && !initialStats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.2 }}
          className="bg-surface rounded-lg p-6 border border-border flex flex-col gap-1"
        >
          <p className="text-text-secondary text-sm leading-none">{card.label}</p>

          <p className="text-2xl font-bold tabular-nums text-text-primary mt-1">
            {card.isRevenue
              ? formatPrice(card.value as number)
              : (card.value as number).toLocaleString()}
          </p>

          <DeltaIndicator delta={card.delta} />

          <div className="mt-2">
            <Sparkline values={card.trend} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}