import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { AdminBusinessRow } from '@/lib/types';
import BusinessTable from './BusinessTable';

export default async function AdminBusinessesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/login');
  }

  const businesses = await prisma.business.findMany({
    include: {
      owner: { select: { email: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const rows: AdminBusinessRow[] = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    plan: b.plan,
    status: b.status,
    createdAt: b.createdAt,
    orderCount: b._count.orders,
    totalRevenue: 0,
    lastActive: null,
    ownerEmail: b.owner?.email ?? null,
  }));

  return <BusinessTable initialRows={rows} />;
}