'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { buildCloudinaryUrl, formatPrice } from '@/lib/utils';
import { IMAGE_TRANSFORMS } from '@/lib/constants';
import type { ProductWithVariants } from '@/lib/types';

type ProductCardProps = {
  product: ProductWithVariants;
  storeSlug: string;
};

export default function ProductCard({ product, storeSlug }: ProductCardProps): React.ReactElement {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const addToast = useUIStore((s) => s.addToast);

  const hasVariants = product.variants.length > 0;
  const outOfStock = product.trackStock && product.stockQuantity === 0;
  const hasDiscount = product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price);
  const discountPct = hasDiscount
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : 0;

  const rawImage = product.images?.[0] ?? null;
  const isCloudinary = rawImage?.includes('res.cloudinary.com') ?? false;
  const imageUrl = rawImage
    ? isCloudinary
      ? buildCloudinaryUrl(rawImage, IMAGE_TRANSFORMS.PRODUCT, 400)
      : rawImage
    : null;

  function handleAddToCart(e: React.MouseEvent<HTMLButtonElement>): void {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      window.location.href = `/${storeSlug}/products/${product.slug}`;
      return;
    }
    addItem({
      productId: product.id, productName: product.name,
      price: Number(product.price), quantity: 1,
      imageUrl: rawImage ?? undefined, slug: product.slug,
    });
    addToast({ variant: 'success', message: `${product.name} added to cart`, duration: 3000 });
  }

  return (
    <div
      onClick={() => { router.push(`/${storeSlug}/products/${product.slug}`); }}
      className="group relative bg-store-surface rounded-2xl overflow-hidden border border-store-border cursor-pointer block w-full transition-all duration-300 hover:border-accent/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 will-change-transform"
    >
      {/* Image */}
      <div className="relative overflow-hidden bg-store-border" style={{ aspectRatio: '3/4' }}>
        {imageUrl ? (
          <Image
            src={imageUrl} alt={product.name} fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-store-border to-store-surface">
            <svg className="w-12 h-12 text-[#d4d4d0]" fill="none" viewBox="0 0 48 48">
              <rect x="8" y="8" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 34l10-10 8 8 6-6 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {hasDiscount && (
            <span className="px-2 py-0.5 rounded-lg bg-accent text-white text-[10px] font-bold tracking-wide shadow-sm">
              -{discountPct}%
            </span>
          )}
          {outOfStock && (
            <span className="px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] font-bold tracking-wide backdrop-blur-sm">
              Sold Out
            </span>
          )}
        </div>

        {/* Desktop hover CTA */}
        {!outOfStock && (
          <button
            onClick={handleAddToCart}
            aria-label={hasVariants ? 'View options' : `Add ${product.name} to cart`}
            className="hidden md:flex absolute bottom-0 left-0 right-0 items-center justify-center h-11 text-[13px] font-semibold text-white translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"
            style={{ background: 'linear-gradient(to right, var(--color-accent), color-mix(in srgb, var(--color-accent) 80%, #3b82f6))' }}
          >
            {hasVariants ? 'Choose Options' : 'Add to Cart'}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <p className="text-[13px] font-semibold text-store-text line-clamp-2 leading-snug mb-2">
          {product.name}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
              {formatPrice(Number(product.price))}
            </span>
            {hasDiscount && (
              <span className="text-[12px] line-through tabular-nums text-[#a8a8a3]">
                {formatPrice(Number(product.compareAtPrice))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile CTA */}
      <div className="px-3.5 pb-3.5 md:hidden">
        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          className="w-full h-10 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: outOfStock ? '#d4d4d0' : 'var(--color-accent)' }}
        >
          {outOfStock ? 'Out of Stock' : hasVariants ? 'Choose Options' : 'Add to Cart'}
        </button>
      </div>
</div>
  );
}