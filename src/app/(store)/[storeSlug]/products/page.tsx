// src/app/(store)/[storeSlug]/products/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { buildCloudinaryUrl, cn } from '@/lib/utils';
import { IMAGE_TRANSFORMS } from '@/lib/constants';
import ProductGrid from '@/components/store/ProductGrid';
import ProductCard from '@/components/store/ProductCard';
import type { StoreConfig, ProductWithVariants } from '@/lib/types';

export const revalidate = 30;

// ─────────────────────────────────────────────
// STATIC PARAMS
// ─────────────────────────────────────────────

export async function generateStaticParams(): Promise<Array<{ storeSlug: string }>> {
  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE' },
    select: { slug: true },
  });
  return businesses.map((b) => ({ storeSlug: b.slug }));
}

// ─────────────────────────────────────────────
// METADATA
// ─────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug: storeSlug },
    select: { name: true, tagline: true },
  });
  return {
    title: business ? `All Products — ${business.name}` : 'Products',
    description: business?.tagline ?? undefined,
  };
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ category?: string; search?: string; page?: string }>;
}): Promise<React.JSX.Element> {
  const { storeSlug } = await params;
  const { category, search, page: pageParam } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const pageSize = 20;

  // Fetch business + config
  const business = await prisma.business.findFirst({
    where: {
      OR: [{ slug: storeSlug }, { domain: storeSlug }],
      status: 'ACTIVE',
    },
    include: { config: true },
  });
  if (!business || !business.config) return notFound();

  // Build where clause
  const where = {
    businessId: business.id,
    status: 'ACTIVE' as const,
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  // Fetch products + total + categories in parallel
  const [products, total, allCategoryRows] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { variants: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: { businessId: business.id, status: 'ACTIVE' },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    }),
  ]);

  const categories = allCategoryRows.map((r) => r.category);
  const totalPages = Math.ceil(total / pageSize);

  const serializedProducts: ProductWithVariants[] = products.map((p) => ({
    ...p,
    price: Number(p.price) as unknown as typeof p.price,
    compareAtPrice: p.compareAtPrice != null ? (Number(p.compareAtPrice) as unknown as typeof p.compareAtPrice) : null,
    createdAt: new Date(p.createdAt.toISOString()),
    updatedAt: new Date(p.updatedAt.toISOString()),
    variants: p.variants.map((v) => ({
      ...v,
      createdAt: new Date(v.createdAt.toISOString()),
    })),
  }));
  const hasMore = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-store-text)' }}
          >
            {category ? category : search ? `Results for "${search}"` : 'All Products'}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {total} {total === 1 ? 'product' : 'products'}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Sidebar filters ── */}
          <aside className="w-full lg:w-52 flex-shrink-0 lg:sticky lg:top-[88px] lg:self-start lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto">

            {/* Search box */}
            <form method="GET" className="hidden lg:block mb-6">
              {category && (
                <input type="hidden" name="category" value={category} />
              )}
              <div className="relative">
                <input
                  type="text"
                  name="search"
                  defaultValue={search ?? ''}
                  placeholder="Search products…"
                  className={cn(
                    'w-full rounded-lg border border-store-border bg-store-surface px-3 py-2 pr-9',
                    'text-sm placeholder:opacity-40 focus:outline-none focus:border-accent',
                  )}
                  style={{ color: 'var(--color-store-text)' }}
                />
                <button
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity"
                  aria-label="Search"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Category filter */}
            {categories.length > 0 && (
              <div>
                <p
                  className="hidden lg:block text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Categories
                </p>
               <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0" style={{ scrollbarWidth: 'none' }}>
                  <a
                    href={`/${storeSlug}/products${search ? `?search=${encodeURIComponent(search)}` : ''}`}
                    className={cn(
                      'flex-shrink-0 whitespace-nowrap px-3 py-1.5 lg:py-2 rounded-full lg:rounded-md text-sm transition-colors',
                      !category
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'border border-store-border lg:border-0 text-store-text hover:bg-store-surface',
                    )}
                    style={!category ? { color: 'var(--color-accent)' } : { color: 'var(--color-store-text)' }}
                  >
                    All
                  </a>
                  {categories.map((cat) => (
                    <a
                      key={cat}
                      href={`/${storeSlug}/products?category=${encodeURIComponent(cat)}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                      className={cn(
                        'flex-shrink-0 whitespace-nowrap px-3 py-1.5 lg:py-2 rounded-full lg:rounded-md text-sm transition-colors',
                        category === cat
                          ? 'bg-accent/10 font-medium'
                          : 'border border-store-border lg:border-0 hover:bg-store-surface',
                      )}
                      style={{
                        color: category === cat
                          ? 'var(--color-accent)'
                          : 'var(--color-store-text)',
                      }}
                    >
                      {cat}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── Product grid ── */}
          <div className="flex-1 min-w-0">
            <ProductGrid
              products={serializedProducts}
              storeSlug={storeSlug}
              CardComponent={ProductCard}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                {hasPrev && (
                  <a
                    href={buildPageUrl(storeSlug, page - 1, category, search)}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm font-medium border border-store-border',
                      'text-store-text hover:border-accent hover:text-accent transition-colors',
                    )}
                  >
                    ← Previous
                  </a>
                )}

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '...' ? (
                        <span
                          key={`ellipsis-${i}`}
                          className="px-2 text-sm"
                          style={{ color: 'var(--color-text-tertiary)' }}
                        >
                          …
                        </span>
                      ) : (
                        <a
                          key={p}
                          href={buildPageUrl(storeSlug, p as number, category, search)}
                          className={cn(
                            'w-9 h-9 flex items-center justify-center rounded-md text-sm font-medium transition-colors',
                            p === page
                              ? 'bg-accent text-accent-text'
                              : 'border border-store-border text-store-text hover:border-accent hover:text-accent',
                          )}
                        >
                          {p}
                        </a>
                      ),
                    )}
                </div>

                {hasMore && (
                  <a
                    href={buildPageUrl(storeSlug, page + 1, category, search)}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm font-medium border border-store-border',
                      'text-store-text hover:border-accent hover:text-accent transition-colors',
                    )}
                  >
                    Next →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function buildPageUrl(
  storeSlug: string,
  page: number,
  category?: string,
  search?: string,
): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return `/${storeSlug}/products${qs ? `?${qs}` : ''}`;
}