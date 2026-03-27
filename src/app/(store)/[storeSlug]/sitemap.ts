// src/app/(store)/[storeSlug]/sitemap.ts
// Per-store sitemap served at /{storeSlug}/sitemap.xml
// Useful when a store uses a custom domain — Google can discover it from the root.

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export const revalidate = 3600;

export const dynamic = 'force-dynamic';

export default async function sitemap({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<MetadataRoute.Sitemap> {
  const { storeSlug } = await params;
  const siteUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  const business = await prisma.business.findFirst({
    where: {
      OR: [{ slug: storeSlug }, { domain: storeSlug }],
      status: 'ACTIVE',
    },
    select: {
      slug: true,
      domain: true,
      updatedAt: true,
      products: {
        where: { status: 'ACTIVE' },
        select: { slug: true, updatedAt: true },
      },
    },
  });

  if (!business) return [];

  const base = business.domain
    ? `https://${business.domain}`
    : `${siteUrl}/${business.slug}`;

  const entries: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: business.updatedAt,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${base}/products`,
      lastModified: business.updatedAt,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...business.products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];

  return entries;
}