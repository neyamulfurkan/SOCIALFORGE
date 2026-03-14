'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { buildCloudinaryUrl, formatPrice } from '@/lib/utils';
import { IMAGE_TRANSFORMS } from '@/lib/constants';
import type { ProductWithVariants, ProductCard } from '@/lib/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ProductDetailProps = {
  product: ProductWithVariants;
  relatedProducts: ProductCard[];
  storeSlug: string;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildVariantLabel(selected: Record<string, string>): string {
  return Object.entries(selected)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

// Derive unique option keys from the variants array.
// Each ProductVariant has a `name` (e.g. "Size") and `options` (Json).
// The Prisma Json type is `unknown` — we cast safely.
function getVariantGroups(
  variants: ProductWithVariants['variants'],
): Array<{ name: string; options: string[] }> {
  return variants.map((v) => {
    const raw = v.options;
    let opts: string[] = [];
    if (Array.isArray(raw)) {
      opts = (raw as unknown[]).map((o) => String(o));
    } else if (raw && typeof raw === 'object') {
      // options may be { values: string[] } shape
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj['values'])) {
        opts = (obj['values'] as unknown[]).map((o) => String(o));
      }
    }
    return { name: v.name, options: opts };
  });
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ProductDetail({
  product,
  relatedProducts,
  storeSlug,
}: ProductDetailProps): React.ReactElement {
  const addItem = useCartStore((s) => s.addItem);
  const addToast = useUIStore((s) => s.addToast);

  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const touchStartXRef = useRef<number | null>(null);

  const images = product.images ?? [];
  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;

  const variantGroups = getVariantGroups(product.variants);
  const hasVariants = variantGroups.length > 0;

  const allVariantsSelected =
    !hasVariants ||
    variantGroups.every((g) => Boolean(selectedVariants[g.name]));

  const outOfStock = product.trackStock && product.stockQuantity === 0;

  const currentRawImage = hasImages ? images[currentImageIndex] : null;
  const currentImageSrc = currentRawImage
    ? (currentRawImage.startsWith('http')
        ? currentRawImage
        : buildCloudinaryUrl(currentRawImage, IMAGE_TRANSFORMS.PRODUCT, 800))
    : null;

  const compareAt = product.compareAtPrice ? Number(product.compareAtPrice) : null;
  const price = Number(product.price);
  const showCompare = compareAt !== null && compareAt !== price;

  // ── Image gallery navigation ──────────────────

  function goToPrevImage(): void {
    setCurrentImageIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }

  function goToNextImage(): void {
    setCurrentImageIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>): void {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>): void {
    if (touchStartXRef.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartXRef.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) {
        goToNextImage();
      } else {
        goToPrevImage();
      }
    }
    touchStartXRef.current = null;
  }

  // ── Variant selection ─────────────────────────

  function selectVariant(groupName: string, option: string): void {
    setSelectedVariants((prev) => ({ ...prev, [groupName]: option }));
  }

  // ── Quantity ──────────────────────────────────

  function decrementQty(): void {
    setQuantity((q) => Math.max(1, q - 1));
  }

  function incrementQty(): void {
    setQuantity((q) => q + 1);
  }

  // ── Add to cart ───────────────────────────────

  function handleAddToCart(): void {
    if (outOfStock || !allVariantsSelected) return;

    const variantLabel = hasVariants ? buildVariantLabel(selectedVariants) : undefined;

    addItem({
      productId: product.id,
      productName: product.name,
      price,
      quantity,
      variantLabel,
      imageUrl: images[0] ?? undefined,
      slug: product.slug,
    });

    addToast({
      variant: 'success',
      message: `${product.name} added to cart`,
      duration: 3000,
    });
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div
      className="max-w-5xl mx-auto px-4 py-8"
      style={{ color: 'var(--color-store-text)' }}
    >
      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">

        {/* ── Image gallery ── */}
        <div>
          {/* Main image */}
          <div
            className="relative w-full rounded-lg overflow-hidden bg-store-border select-none"
            style={{ aspectRatio: '3/4' }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {currentImageSrc ? (
              <Image
                src={currentImageSrc}
                alt={`${product.name} — image ${currentImageIndex + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-store-border)' }}
              >
                <svg
                  className="w-16 h-16"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <rect
                    x="8" y="8" width="32" height="32" rx="4"
                    stroke="currentColor" strokeWidth="2"
                  />
                  <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M8 34l10-10 8 8 6-6 8 8"
                    stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}

            {/* Prev / Next arrows — only when multiple images */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={goToPrevImage}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={goToNextImage}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Dot indicators */}
          {hasMultipleImages && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  aria-label={`Go to image ${idx + 1}`}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: idx === currentImageIndex ? 20 : 8,
                    height: 8,
                    backgroundColor:
                      idx === currentImageIndex
                        ? 'var(--color-accent)'
                        : 'var(--color-store-border)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Thumbnail strip — only when 3+ images */}
          {images.length >= 2 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {images.map((img, idx) => {
                const thumbSrc = img.startsWith('http')
                  ? img
                  : buildCloudinaryUrl(img, IMAGE_TRANSFORMS.PRODUCT, 80);
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    aria-label={`View image ${idx + 1}`}
                    className="flex-shrink-0 rounded overflow-hidden border-2 transition-colors"
                    style={{
                      borderColor:
                        idx === currentImageIndex
                          ? 'var(--color-accent)'
                          : 'transparent',
                      width: 60,
                      height: 80,
                    }}
                  >
                    <Image
                      src={thumbSrc}
                      alt={`Thumbnail ${idx + 1}`}
                      width={60}
                      height={80}
                      className="object-cover w-full h-full"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Product info ── */}
        <div className="flex flex-col gap-5">

          {/* Name */}
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-store-text)' }}>
            {product.name}
          </h1>

          {/* Price row */}
          <div className="flex items-baseline gap-3">
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: 'var(--color-accent)' }}
            >
              {formatPrice(price)}
            </span>
            {showCompare && (
              <span
                className="text-base line-through tabular-nums"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {formatPrice(compareAt!)}
              </span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {product.description}
            </p>
          )}

          {/* Variant selectors */}
          {variantGroups.map((group) => (
            <div key={group.name}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-store-text)' }}>
                {group.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const isSelected = selectedVariants[group.name] === option;
                  return (
                    <button
                      key={option}
                      onClick={() => selectVariant(group.name, option)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors duration-150"
                      style={{
                        borderColor: isSelected
                          ? 'var(--color-accent)'
                          : 'var(--color-store-border)',
                        backgroundColor: isSelected
                          ? 'var(--color-accent)'
                          : 'var(--color-store-surface)',
                        color: isSelected
                          ? 'var(--color-accent-text)'
                          : 'var(--color-store-text)',
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Variant selection hint */}
          {hasVariants && !allVariantsSelected && (
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Please select all options before adding to cart.
            </p>
          )}

          {/* Quantity selector */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-store-text)' }}>
              Quantity
            </p>
            <div className="inline-flex items-center border rounded-md overflow-hidden" style={{ borderColor: 'var(--color-store-border)' }}>
              <button
                onClick={decrementQty}
                aria-label="Decrease quantity"
                className="w-10 h-10 flex items-center justify-center text-lg font-medium transition-colors hover:bg-gray-100"
                style={{ color: 'var(--color-store-text)' }}
              >
                −
              </button>
              <span
                className="w-10 h-10 flex items-center justify-center text-sm font-semibold tabular-nums"
                style={{ color: 'var(--color-store-text)' }}
                aria-live="polite"
              >
                {quantity}
              </span>
              <button
                onClick={incrementQty}
                aria-label="Increase quantity"
                className="w-10 h-10 flex items-center justify-center text-lg font-medium transition-colors hover:bg-gray-100"
                style={{ color: 'var(--color-store-text)' }}
              >
                +
              </button>
            </div>
          </div>

          {/* Add to Cart button */}
          <button
            onClick={handleAddToCart}
            disabled={outOfStock || !allVariantsSelected}
            className="w-full h-12 rounded-md text-base font-semibold transition-colors duration-150"
            style={
              outOfStock || !allVariantsSelected
                ? {
                    backgroundColor: 'var(--color-surface-raised)',
                    color: 'var(--color-text-tertiary)',
                    cursor: outOfStock ? 'not-allowed' : 'default',
                  }
                : {
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-accent-text)',
                    cursor: 'pointer',
                  }
            }
          >
            {outOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>

          {/* Out of stock note */}
          {outOfStock && (
            <p className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              This product is currently unavailable.
            </p>
          )}
        </div>
      </div>

      {/* ── Related products ── */}
      {relatedProducts.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-store-text)' }}>
            You might also like
          </h2>
          <div
            className="flex gap-4 overflow-x-auto pb-2"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {relatedProducts.map((related) => {
              const relatedThumbSrc = related.imageUrl?.startsWith('http')
                ? related.imageUrl
                : buildCloudinaryUrl(
                    related.imageUrl,
                    IMAGE_TRANSFORMS.PRODUCT,
                    200,
                  );
              return (
                <Link
                  key={related.id}
                  href={`/${storeSlug}/products/${related.slug}`}
                  className="flex-shrink-0 rounded-lg overflow-hidden border transition-shadow hover:shadow-md"
                  style={{
                    width: 140,
                    scrollSnapAlign: 'start',
                    borderColor: 'var(--color-store-border)',
                    backgroundColor: 'var(--color-store-surface)',
                  }}
                >
                  <div style={{ aspectRatio: '3/4', position: 'relative' }}>
                    <Image
                      src={relatedThumbSrc}
                      alt={related.name}
                      fill
                      className="object-cover"
                      sizes="140px"
                    />
                  </div>
                  <div className="p-2">
                    <p
                      className="text-xs font-medium line-clamp-2 mb-1"
                      style={{ color: 'var(--color-store-text)' }}
                    >
                      {related.name}
                    </p>
                    <p
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      {formatPrice(related.price)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}