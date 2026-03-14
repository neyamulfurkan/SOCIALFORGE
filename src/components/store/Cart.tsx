'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { formatPrice, cn } from '@/lib/utils';

type CartProps = {
  storeSlug: string;
  deliveryCharge: number;
  freeDeliveryThreshold: number | null;
  outOfStockIds?: string[];
  variant?: 'panel' | 'page';
};

export default function Cart({
  storeSlug,
  deliveryCharge,
  freeDeliveryThreshold,
  outOfStockIds = [],
  variant = 'page',
}: CartProps): React.JSX.Element {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const appliedDelivery =
    freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold
      ? 0
      : deliveryCharge;
  const total = subtotal + appliedDelivery;

  const isPanel = variant === 'panel';

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center',
          isPanel ? 'p-6 h-full min-h-64' : 'py-24 px-4',
        )}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mb-4 opacity-30"
          aria-hidden="true"
        >
          <rect x="10" y="20" width="60" height="48" rx="6" stroke="currentColor" strokeWidth="3" fill="none" />
          <path d="M28 20v-4a12 12 0 0 1 24 0v4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
          <circle cx="40" cy="44" r="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
        </svg>
        <p className="text-lg font-semibold text-[var(--color-store-text)] mb-1">
          Your cart is empty
        </p>
        <p className="text-sm text-[var(--color-store-text)] opacity-50 mb-6">
          Looks like you haven&apos;t added anything yet.
        </p>
        <Link
          href={`/${storeSlug}/products`}
          className="inline-block bg-[var(--color-accent)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col',
        isPanel
          ? 'h-full'
          : 'max-w-2xl mx-auto px-4 py-10',
      )}
    >
      {/* Items list */}
      <ul className={cn('flex-1 divide-y divide-[var(--color-store-border)]', isPanel && 'overflow-y-auto')}>
        {items.map((item) => {
          const key = item.productId + (item.variantLabel ?? '');
          const isOutOfStock = outOfStockIds.includes(item.productId);

          return (
            <li
              key={key}
              className={cn(
                'flex gap-3 items-start',
                isPanel ? 'py-3 px-4' : 'py-4',
              )}
            >
              {/* Thumbnail */}
              {item.imageUrl ? (
                <div className="relative flex-shrink-0 w-14 h-14 rounded overflow-hidden bg-[var(--color-store-border)]">
                  <Image
                    src={item.imageUrl}
                    alt={item.productName}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 w-14 h-14 rounded bg-[var(--color-store-border)]" />
              )}

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-store-text)] truncate">
                  {item.productName}
                </p>
                {item.variantLabel && (
                  <p className="text-xs text-[var(--color-store-text)] opacity-50 mt-0.5">
                    {item.variantLabel}
                  </p>
                )}

                {isOutOfStock && (
                  <span className="inline-block mt-1 text-xs font-medium text-[var(--color-error)] bg-[var(--color-error)]/10 px-2 py-0.5 rounded-full">
                    Out of stock
                  </span>
                )}

                {/* Quantity controls */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.productId, item.variantLabel, Math.max(1, item.quantity - 1))
                    }
                    disabled={item.quantity <= 1}
                    aria-label="Decrease quantity"
                    className="w-7 h-7 rounded-full border border-[var(--color-store-border)] flex items-center justify-center text-[var(--color-store-text)] text-sm disabled:opacity-30 hover:bg-[var(--color-store-border)] transition-colors"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-[var(--color-store-text)] tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(item.productId, item.variantLabel, item.quantity + 1)
                    }
                    aria-label="Increase quantity"
                    className="w-7 h-7 rounded-full border border-[var(--color-store-border)] flex items-center justify-center text-[var(--color-store-text)] text-sm hover:bg-[var(--color-store-border)] transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price + remove */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-[var(--color-store-text)] tabular-nums">
                  {formatPrice(item.price * item.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId, item.variantLabel)}
                  aria-label={`Remove ${item.productName}`}
                  className="text-[var(--color-store-text)] opacity-30 hover:opacity-70 transition-opacity"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Summary */}
      <div
        className={cn(
          'border-t border-[var(--color-store-border)] space-y-2',
          isPanel ? 'px-4 pt-4 pb-4' : 'pt-6',
        )}
      >
        <div className="flex justify-between text-sm text-[var(--color-store-text)]">
          <span className="opacity-60">Subtotal</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm text-[var(--color-store-text)]">
          <span className="opacity-60">Delivery</span>
          {appliedDelivery === 0 ? (
            <span className="text-[var(--color-success)] font-medium">Free delivery</span>
          ) : (
            <span className="tabular-nums">{formatPrice(appliedDelivery)}</span>
          )}
        </div>

        {freeDeliveryThreshold !== null && appliedDelivery > 0 && (
          <p className="text-xs text-[var(--color-store-text)] opacity-40">
            Add {formatPrice(freeDeliveryThreshold - subtotal)} more for free delivery
          </p>
        )}

        <div className="flex justify-between text-base font-bold text-[var(--color-store-text)] pt-2 border-t border-[var(--color-store-border)]">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(total)}</span>
        </div>

        <Link
          href={`/${storeSlug}/checkout`}
          className="block w-full bg-[var(--color-accent)] text-white text-center py-3 rounded-lg font-medium hover:bg-[var(--color-accent-hover)] transition-colors mt-4 text-sm"
        >
          Checkout
        </Link>

        <Link
          href={`/${storeSlug}/products`}
          className="block w-full text-center py-2 text-sm text-[var(--color-store-text)] opacity-50 hover:opacity-80 transition-opacity"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}