import { prisma } from '@/lib/db';
import SearchOverlay from '@/components/store/SearchOverlay';
import type { ProductWithVariants } from '@/lib/types';

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { storeSlug } = await params;
  const { q } = await searchParams;

  const query = q ? q.slice(0, 200).trim() : '';

  const business = await prisma.business.findUnique({
    where: { slug: storeSlug },
    select: { id: true },
  });

  let results: ProductWithVariants[] = [];

  if (business) {
    if (query.length > 0) {
      results = await prisma.product.findMany({
        where: {
          businessId: business.id,
          status: 'ACTIVE',
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: { variants: true },
        take: 20,
      });
    } else {
      results = await prisma.product.findMany({
        where: {
          businessId: business.id,
          status: 'ACTIVE',
        },
        include: { variants: true },
        take: 8,
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  return (
    <SearchOverlay
      initialResults={results}
      initialQuery={query}
      storeSlug={storeSlug}
      open={true}
    />
  );
}