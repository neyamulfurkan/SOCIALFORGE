// src/app/(admin)/admin/businesses/[businessId]/page.tsx
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatPrice, formatRelativeTime } from '@/lib/utils';
import BusinessDetailClient from './BusinessDetailClient';
import type { Business, BusinessConfig, User, PlatformConfig } from '@prisma/client';

type FullBusiness = Business & {
  config: BusinessConfig | null;
  owner: User | null;
  platformConfig: PlatformConfig[];
};

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const session = await auth();

  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/login');

  const [business, orderStats, postCount, convCount] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      include: { config: true, owner: true, platformConfig: true },
    }),
    prisma.order.aggregate({
      where: { businessId },
      _count: true,
      _sum: { total: true },
    }),
    prisma.socialPost.count({ where: { businessId } }),
    prisma.messengerConversation.count({ where: { businessId } }),
  ]);

  if (!business) return notFound();

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Static header — rendered server-side */}
      <BusinessHeader business={business} />

      {/* Usage stats — static, no interactivity needed */}
      <UsageStats
        orderCount={orderStats._count}
        totalRevenue={Number(orderStats._sum.total ?? 0)}
        postCount={postCount}
        convCount={convCount}
      />

      {/* All interactive sections delegated to client component */}
      <BusinessDetailClient
        business={JSON.parse(JSON.stringify(business)) as FullBusiness}
        businessId={businessId}
      />
    </div>
  );
}

// ─── BusinessHeader ───────────────────────────

function BusinessHeader({ business }: { business: FullBusiness }) {
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-500/10 text-green-400',
    SUSPENDED: 'bg-yellow-500/10 text-yellow-400',
    CANCELLED: 'bg-red-500/10 text-red-400',
  };
  const planColors: Record<string, string> = {
    TRIAL: 'bg-accent/10 text-accent',
    STARTER: 'bg-blue-500/10 text-blue-400',
    PRO: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="flex items-start gap-4">
      {business.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={business.logo}
          alt={business.name}
          className="w-16 h-16 rounded-lg object-cover border border-border"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg border border-border bg-surface flex items-center justify-center text-2xl font-bold text-text-secondary">
          {business.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-text-primary">{business.name}</h1>
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              statusColors[business.status] ?? 'bg-surface text-text-secondary'
            }`}
          >
            {business.status}
          </span>
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              planColors[business.plan] ?? 'bg-surface text-text-secondary'
            }`}
          >
            {business.plan}
          </span>
        </div>
        <p className="text-text-secondary text-sm mt-1">
          /{business.slug}
          {business.domain ? ` · ${business.domain}` : ''}
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary flex-wrap">
          <span>Owner: {business.owner?.email ?? 'No owner'}</span>
          <span>Registered {formatRelativeTime(new Date(business.createdAt))}</span>
          {business.planExpiresAt && (
            <span>
              Plan expires{' '}
              {formatRelativeTime(new Date(business.planExpiresAt))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UsageStats ───────────────────────────────

function UsageStats({
  orderCount,
  totalRevenue,
  postCount,
  convCount,
}: {
  orderCount: number;
  totalRevenue: number;
  postCount: number;
  convCount: number;
}) {
  const stats = [
    { label: 'Total Orders', value: orderCount.toLocaleString() },
    { label: 'Total Revenue', value: formatPrice(totalRevenue) },
    { label: 'Social Posts', value: postCount.toLocaleString() },
    { label: 'Conversations', value: convCount.toLocaleString() },
  ];

  return (
    <section>
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Usage Stats
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-surface border border-border rounded-lg p-4"
          >
            <p className="text-xs text-text-tertiary">{s.label}</p>
            <p className="text-xl font-bold text-text-primary mt-1">{s.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}