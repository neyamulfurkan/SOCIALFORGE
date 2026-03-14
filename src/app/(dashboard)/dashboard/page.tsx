import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { DashboardStats, ActivityItem } from '@/lib/types';

// StatCards and ActivityFeed are not yet generated — forward-declared below.
// When FILE 064 and FILE 065 are generated, they MUST match these assumed prop interfaces:
//
// StatCards props: { initialStats: DashboardStats; businessId: string }
// ActivityFeed props: { initialActivities: ActivityItem[]; businessId: string }
//
// Both are Client Components that wrap TanStack Query with the initialData pattern.

import StatCards from '@/components/dashboard/StatCards';
import ActivityFeed from '@/components/dashboard/ActivityFeed';

const QUICK_ACTIONS = [
  { href: '/dashboard/products', label: 'Add Product', icon: '📦' },
  { href: '/dashboard/orders', label: 'View Orders', icon: '🛍' },
  { href: '/dashboard/messages', label: 'Check Messages', icon: '💬' },
  { href: '/dashboard/social', label: 'Review Posts', icon: '📱' },
] as const;

export default async function DashboardHomePage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user?.businessId) {
    redirect('/login');
  }

  const businessId = session.user.businessId;
  const userName = session.user.name?.split(' ')[0] ?? 'there';

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayOrders, revenueRows, activeConversations, pendingPosts, activities] =
    await Promise.all([
      prisma.order.count({
        where: { businessId, createdAt: { gte: todayStart } },
      }),
      prisma.order.aggregate({
        where: {
          businessId,
          createdAt: { gte: monthStart },
          paymentStatus: 'PAID',
        },
        _sum: { total: true },
      }),
      prisma.messengerConversation.count({
        where: { businessId, status: 'OPEN' },
      }),
      prisma.socialPost.count({
        where: { businessId, status: 'PENDING_REVIEW' },
      }),
      prisma.activityLog.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

  const stats: DashboardStats = {
    todayOrders,
    revenueThisMonth: Number(revenueRows._sum.total ?? 0),
    activeConversations,
    pendingPosts,
    ordersDelta: 0,
    revenueDelta: 0,
  };

  const activityItems: ActivityItem[] = activities.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    description: a.description,
    timestamp: a.createdAt,
    actionUrl: a.actionUrl ?? undefined,
    actionLabel: a.actionLabel ?? undefined,
    metadata: (a.metadata as Record<string, unknown>) ?? undefined,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Good morning, {userName}! 👋
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          {now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      <StatCards initialStats={stats} businessId={businessId} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="bg-surface rounded-lg p-4 text-center hover:bg-surface-raised transition-colors border border-border"
          >
            <div className="text-3xl mb-2">{action.icon}</div>
            <p className="font-medium text-sm text-text-primary">{action.label}</p>
          </Link>
        ))}
      </div>

      <ActivityFeed initialActivities={activityItems} businessId={businessId} />
    </div>
  );
}