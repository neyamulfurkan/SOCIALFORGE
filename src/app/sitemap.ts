// src/app/sitemap.ts
// Dynamic sitemap covering every active store homepage, products listing,
// and individual product detail page — used by Google for indexing.

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export const revalidate = 3600;

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  // Fetch all active businesses with their active products
  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE' },
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

  const entries: MetadataRoute.Sitemap = [];

  for (const business of businesses) {
    const base = business.domain
      ? `https://${business.domain}`
      : `${siteUrl}/${business.slug}`;

    // Store homepage
    entries.push({
      url: base,
      lastModified: business.updatedAt,
      changeFrequency: 'daily',
      priority: 1.0,
    });

    // Products listing
    entries.push({
      url: `${base}/products`,
      lastModified: business.updatedAt,
      changeFrequency: 'daily',
      priority: 0.9,
    });

    // Individual product pages
    for (const product of business.products) {
      entries.push({
        url: `${base}/products/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }

  return entries;
}