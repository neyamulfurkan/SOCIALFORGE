'use client';

import { motion } from 'framer-motion';
import type { ProductWithVariants } from '@/lib/types';

// ─────────────────────────────────────────────
// Skeleton Card
// ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-store-surface rounded-lg overflow-hidden">
      <div className="aspect-[3/4] bg-store-border animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-store-border rounded animate-pulse" />
        <div className="h-4 bg-store-border rounded w-2/3 animate-pulse" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="col-span-2 md:col-span-3 xl:col-span-4 flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="w-20 h-20 mb-4"
        style={{ color: 'var(--color-store-border)' }}
        fill="none"
        viewBox="0 0 80 80"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Shopping bag illustration */}
        <rect x="16" y="28" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="3" />
        <path
          d="M28 28c0-6.627 5.373-12 12-12s12 5.373 12 12"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M32 44h16M40 36v16"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-store-text)' }}>
        No products found
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Check back soon — new products are on the way.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Inline ProductCard stub
// (FILE 057 not yet generated — will be replaced when FILE 057 is produced)
// ─────────────────────────────────────────────

function ProductCardStub({
  product,
  storeSlug,
}: {
  product: ProductWithVariants;
  storeSlug: string;
}) {
  const firstImage = product.images?.[0];
  const price =
    typeof product.price === 'object' &&
    typeof (product.price as { toNumber?: () => number }).toNumber === 'function'
      ? (product.price as { toNumber: () => number }).toNumber()
      : Number(product.price);

  return (
    <a
      href={`/${storeSlug}/products/${product.slug}`}
      className="block bg-store-surface rounded-lg overflow-hidden border border-store-border hover:shadow-md transition-shadow duration-200"
    >
      <div className="aspect-[3/4] bg-store-border overflow-hidden">
        {firstImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstImage}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-12 h-12"
              style={{ color: 'var(--color-store-border)' }}
              fill="none"
              viewBox="0 0 48 48"
            >
              <rect x="8" y="8" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="2" />
              <path d="M8 34l10-10 8 8 6-6 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <p
          className="text-sm font-medium line-clamp-2 mb-1"
          style={{ color: 'var(--color-store-text)' }}
        >
          {product.name}
        </p>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
          ৳{price.toLocaleString()}
        </p>
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────
// Framer Motion variants
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2 },
  },
};

// ─────────────────────────────────────────────
// ProductGrid
// ─────────────────────────────────────────────

type ProductGridProps = {
  products: ProductWithVariants[];
  storeSlug: string;
  loading?: boolean;
  /** Pass the real ProductCard component once FILE 057 is generated */
  CardComponent?: React.ComponentType<{ product: ProductWithVariants; storeSlug: string }>;
};

export default function ProductGrid({
  products,
  storeSlug,
  loading = false,
  CardComponent,
}: ProductGridProps) {
  const Card = CardComponent ?? ProductCardStub;

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 w-full overflow-visible"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
    >
      {loading ? (
        Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
      ) : products.length === 0 ? (
        <EmptyState />
      ) : (
        products.map((product) => (
          <motion.div key={product.id} variants={itemVariants} className="w-full min-w-0">
            <Card product={product} storeSlug={storeSlug} />
          </motion.div>
        ))
      )}
    </motion.div>
  );
}