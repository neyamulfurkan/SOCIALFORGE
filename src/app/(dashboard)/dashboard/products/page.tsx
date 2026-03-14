'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useUIStore } from '@/store/uiStore';
import ProductDrawer from '@/components/dashboard/ProductDrawer';
import Badge, { StatusBadge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { formatPrice, buildCloudinaryUrl, cn } from '@/lib/utils';
import type { ProductWithVariants } from '@/lib/types';

// ─────────────────────────────────────────────
// Sub-components (used only in this file)
// ─────────────────────────────────────────────

type ProductGridCardProps = {
  product: ProductWithVariants;
  onEdit: () => void;
  onArchive: () => void;
};

function ProductGridCard({ product, onEdit, onArchive }: ProductGridCardProps) {
  const rawImage = product.images?.[0] ?? null;
  const isCloudinary = rawImage?.includes('res.cloudinary.com') ?? false;
  const imageUrl = rawImage
    ? isCloudinary
      ? buildCloudinaryUrl(rawImage, 'c_fill,ar_3:4,f_auto,q_auto', 400)
      : rawImage
    : null;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden group flex flex-col">
      {/* Image */}
      <div className="relative aspect-[3/4] bg-surface-raised overflow-hidden">
        {imageUrl ? (
          isCloudinary ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
          ) : (
          <img
            src={imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-tertiary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
        {/* Hover overlay with actions */}
        <div
          className={cn(
            'absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100',
            'transition-opacity duration-200 flex items-end justify-end gap-2 p-2',
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="bg-white text-base px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            className="bg-white text-base px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Archive
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-text-primary font-medium text-sm line-clamp-2 leading-snug">
          {product.name}
        </p>
        <p className="text-accent font-semibold text-sm tabular-nums">
          {formatPrice(Number(product.price))}
        </p>
        <div className="flex items-center justify-between mt-auto pt-2">
          <StatusBadge status={product.status} />
          {product.trackStock && (
            <span
              className={cn(
                'text-xs',
                product.stockQuantity === 0
                  ? 'text-error'
                  : product.stockQuantity <= 5
                    ? 'text-warning'
                    : 'text-text-tertiary',
              )}
            >
              {product.stockQuantity === 0
                ? 'Out of stock'
                : `${product.stockQuantity} in stock`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-surface-raised" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-4 bg-surface-raised rounded w-3/4" />
        <div className="h-4 bg-surface-raised rounded w-1/3" />
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-text-tertiary"
      >
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <div>
        <p className="text-text-primary font-semibold text-lg">No products yet</p>
        <p className="text-text-secondary text-sm mt-1">
          Add your first product to get started.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="bg-accent text-accent-text px-5 py-2.5 rounded-md font-medium hover:bg-accent-hover transition-colors"
      >
        Add your first product
      </button>
    </div>
  );
}

function EmptyFilterState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <p className="text-text-primary font-semibold text-lg">No products match your filters</p>
      <p className="text-text-secondary text-sm">Try adjusting your search or filter criteria.</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────

export default function ProductsPage() {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId ?? '';
  const queryClient = useQueryClient();
  const { openDrawer } = useUIStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Fetch all products for this business ──
  const { data, isLoading } = useQuery({
    queryKey: ['products', businessId],
    queryFn: async (): Promise<{ data: ProductWithVariants[] }> => {
      const res = await fetch('/api/products', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });

  // ── Client-side filtering ──
  const allProducts: ProductWithVariants[] = data?.data ?? [];
  const filtered = allProducts.filter((p) => {
    const matchSearch =
      !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || p.category === categoryFilter;
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const hasFilters = !!(search || categoryFilter || statusFilter);

  // ── Archive mutation ──
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to archive product');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', businessId] });
      toast.success('Product archived');
    },
    onError: () => {
      toast.error('Failed to archive product');
    },
  });

  // ── Duplicate mutation ──
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to duplicate product');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', businessId] });
      toast.success('Product duplicated as draft');
    },
    onError: () => {
      toast.error('Failed to duplicate product');
    },
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Products</h1>
          {!isLoading && (
            <p className="text-text-secondary text-sm mt-0.5">
              {allProducts.length} product{allProducts.length !== 1 ? 's' : ''} total
            </p>
          )}
        </div>
        <button
          onClick={() => openDrawer('product')}
          className="bg-accent text-accent-text px-4 py-2 rounded-md font-medium hover:bg-accent-hover transition-colors text-sm"
        >
          + Add Product
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className={cn(
            'bg-surface border border-border rounded-md px-3 py-2 text-sm',
            'text-text-primary placeholder:text-text-tertiary',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
            'flex-1 min-w-0',
          )}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={cn(
            'bg-surface border border-border rounded-md px-3 py-2 text-sm',
            'text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
            'sm:w-48',
          )}
        >
          <option value="">All Categories</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={cn(
            'bg-surface border border-border rounded-md px-3 py-2 text-sm',
            'text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
            'sm:w-36',
          )}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setSearch('');
              setCategoryFilter('');
              setStatusFilter('');
            }}
            className="text-text-secondary text-sm hover:text-text-primary transition-colors whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : allProducts.length === 0 ? (
        <EmptyState onAdd={() => openDrawer('product')} />
      ) : filtered.length === 0 ? (
        <EmptyFilterState />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <ProductGridCard
              key={product.id}
              product={product}
              onEdit={() => openDrawer('product', product.id)}
              onArchive={() => archiveMutation.mutate(product.id)}
            />
          ))}
        </div>
      )}

      {/* ── ProductDrawer (sibling, shown/hidden via uiStore) ── */}
      <ProductDrawer businessId={businessId} />
    </div>
  );
}