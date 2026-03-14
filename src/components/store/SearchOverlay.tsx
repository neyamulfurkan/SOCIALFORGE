'use client';

import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, truncate, buildCloudinaryUrl, cn } from '@/lib/utils';
import type { ProductWithVariants } from '@/lib/types';

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchOverlayProps = {
  initialResults?: ProductWithVariants[];
  initialQuery?: string;
  storeSlug: string;
  open?: boolean;
};

// ─── Result Item ──────────────────────────────────────────────────────────────

function ResultItem({
  product,
  storeSlug,
  onSelect,
}: {
  product: ProductWithVariants;
  storeSlug: string;
  onSelect: () => void;
}) {
  const imageUrl = product.images?.[0]
    ? buildCloudinaryUrl(product.images[0], 'c_fill,ar_1:1,w_80,f_auto,q_auto')
    : null;

  return (
    <Link
      href={`/${storeSlug}/products/${product.slug}`}
      onClick={onSelect}
      className="flex items-center gap-3 p-3 rounded-2xl transition-all duration-150 active:scale-[0.98] hover:bg-black/[0.04]"
    >
      <div
        className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/[0.06]"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">🛍️</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate text-store-text">{product.name}</p>
        <p className="text-[12px] font-medium mt-0.5 text-accent">{formatPrice(Number(product.price))}</p>
      </div>
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4 shrink-0 text-store-text-tertiary"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

// ─── SearchOverlay ────────────────────────────────────────────────────────────

export default function SearchOverlay({
  initialResults = [],
  initialQuery = '',
  storeSlug,
  open: openProp,
}: SearchOverlayProps) {
  const router = useRouter();
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);

  const isOpen = openProp !== undefined ? openProp : false;

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ProductWithVariants[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Animate in/out ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        });
      });
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // ── Escape key ──────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) close();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Debounced search ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (query.length === 0) {
      setResults(initialResults);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const url = `/api/products/public/${encodeURIComponent(storeSlug)}?search=${encodeURIComponent(query)}&pageSize=20`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Search failed');
        const json = await res.json();
        setResults(json.data ?? json ?? []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isOpen, storeSlug]);

  function close() {
    setVisible(false);
    setTimeout(() => setSearchOpen(false), 150);
  }

  if (!isOpen) return null;

  const hasContent = loading || results.length > 0 || query.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{
          backgroundColor: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        onClick={close}
        aria-hidden="true"
      />

      {/* Search panel — slim floating bar */}
      <div
        className="fixed left-0 right-0 z-[9999] px-3 pt-3"
        style={{
          top: 0,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-12px)',
          transition: 'opacity 200ms ease, transform 200ms cubic-bezier(0.16,1,0.3,1)',
          // Force light text context — prevents dark body color bleeding in
          color: 'var(--color-store-text)',
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2.5 h-10 px-3.5 rounded-2xl transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: query.length > 0
                ? '1.5px solid color-mix(in srgb, var(--color-accent) 35%, transparent)'
                : '1.5px solid rgba(0,0,0,0.08)',
              boxShadow: query.length > 0
                ? '0 0 0 3px color-mix(in srgb, var(--color-accent) 10%, transparent), 0 4px 16px rgba(0,0,0,0.08)'
                : '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <SearchIcon className={cn(
              'w-4 h-4 shrink-0 transition-colors duration-200',
              query.length > 0 ? 'text-accent' : 'text-store-text-tertiary',
            )} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="flex-1 bg-transparent text-[14px] focus:outline-none text-store-text placeholder:text-store-text-tertiary"
            />
            {query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear"
                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-black/[0.1] hover:bg-black/[0.16] transition-colors"
              >
                <CloseIcon className="w-2.5 h-2.5 text-store-text-secondary" />
              </button>
            )}
          </div>

          {/* Cancel button */}
          <button
            onClick={close}
            aria-label="Close search"
            className="shrink-0 h-10 px-3.5 rounded-2xl text-[13px] font-semibold transition-all duration-200 text-accent"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(0,0,0,0.08)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            Cancel
          </button>
        </div>

        {/* Results dropdown */}
        {hasContent && (
          <div
            className="mt-2 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              maxHeight: '60vh',
              overflowY: 'auto',
              // Anchor color context so all children inherit light-theme colors
              color: 'var(--color-store-text)',
            }}
          >
            {loading ? (
              <div className="px-3 py-3 space-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-black/[0.03]">
                    <div className="w-10 h-10 rounded-lg bg-black/[0.06] animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-black/[0.06] animate-pulse rounded w-3/4" />
                      <div className="h-2.5 bg-black/[0.04] animate-pulse rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="px-3 py-2">
                <p className="text-[10px] font-bold text-store-text-tertiary uppercase tracking-[0.12em] px-1 py-1.5">
                  {query.length > 0
                    ? `${results.length} result${results.length !== 1 ? 's' : ''}`
                    : 'Popular'}
                </p>
                <div className="space-y-0.5">
                  {results.slice(0, 6).map((product) => (
                    <ResultItem
                      key={product.id}
                      product={product}
                      storeSlug={storeSlug}
                      onSelect={close}
                    />
                  ))}
                </div>
                {query.length > 0 && (
                  <Link
                    href={`/${storeSlug}/search?q=${encodeURIComponent(query)}`}
                    onClick={close}
                    className="flex items-center justify-center gap-1.5 mt-2 h-9 rounded-xl text-[12px] font-semibold text-accent transition-colors hover:bg-black/[0.03]"
                    style={{ background: 'color-mix(in srgb, var(--color-accent) 7%, transparent)' }}
                  >
                    See all results
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                )}
              </div>
            ) : query.length > 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-[14px] font-semibold text-store-text mb-1">No results found</p>
                <p className="text-[12px] text-store-text-tertiary">Try a different search term</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Empty state — quick links (shown when no query yet) */}
        {!hasContent && (
          <div className="mt-2 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              color: 'var(--color-store-text)',
            }}
          >
            <div className="px-4 pt-3 pb-4">
              <p className="text-[10px] font-bold text-store-text-tertiary uppercase tracking-[0.12em] px-1 pb-3">
                Quick links
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'All Products', href: `/${storeSlug}/products`, emoji: '🛍️' },
                  { label: 'New Arrivals', href: `/${storeSlug}/products?sort=new`, emoji: '✨' },
                ].map(({ label, href, emoji }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={close}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/[0.04] hover:bg-black/[0.07] transition-colors"
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="text-[13px] font-semibold text-store-text">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}