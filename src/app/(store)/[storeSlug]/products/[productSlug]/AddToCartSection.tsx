'use client';

import { useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

type Variant = {
  id: string;
  name: string;
  options: string[];
};

type Props = {
  product: {
    id: string;
    name: string;
    price: number;
    slug: string;
    images: string[];
    trackStock: boolean;
    stockQuantity: number;
    variants: Variant[];
  };
  storeSlug: string;
};

export default function AddToCartSection({ product, storeSlug }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const addToast = useUIStore((s) => s.addToast);

  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const outOfStock = product.trackStock && product.stockQuantity === 0;
  const hasVariants = product.variants.length > 0;

  const allVariantsSelected =
    !hasVariants ||
    product.variants.every((v) => selectedOptions[v.name]);

  const variantLabel = hasVariants
    ? product.variants
        .map((v) => selectedOptions[v.name])
        .filter(Boolean)
        .join(' / ')
    : undefined;

  function handleAddToCart() {
    if (outOfStock || !allVariantsSelected) return;
    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity,
      imageUrl: product.images[0] ?? undefined,
      slug: product.slug,
      variantLabel: variantLabel || undefined,
    });
    addToast({ variant: 'success', message: `${product.name} added to cart`, duration: 3000 });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Variant selectors */}
      {product.variants.map((variant) => (
        <div key={variant.id}>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-store-text)' }}>
            {variant.name}
            {selectedOptions[variant.name] && (
              <span className="ml-2 font-normal opacity-60">
                {selectedOptions[variant.name]}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {variant.options.map((option) => (
              <button
                key={option}
                onClick={() =>
                  setSelectedOptions((prev) => ({ ...prev, [variant.name]: option }))
                }
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md border transition-colors',
                  selectedOptions[variant.name] === option
                    ? 'border-accent bg-accent/10 text-accent font-medium'
                    : 'border-store-border text-store-text hover:border-accent/50',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium" style={{ color: 'var(--color-store-text)' }}>
          Quantity
        </p>
        <div className="flex items-center border border-store-border rounded-md overflow-hidden">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-9 h-9 flex items-center justify-center text-store-text hover:bg-store-border transition-colors"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span
            className="w-10 text-center text-sm font-medium"
            style={{ color: 'var(--color-store-text)' }}
          >
            {quantity}
          </span>
          <button
            onClick={() =>
              setQuantity((q) =>
                product.trackStock ? Math.min(product.stockQuantity, q + 1) : q + 1,
              )
            }
            className="w-9 h-9 flex items-center justify-center text-store-text hover:bg-store-border transition-colors"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {/* Add to cart button */}
      <button
        onClick={handleAddToCart}
        disabled={outOfStock || !allVariantsSelected}
        className={cn(
          'w-full h-12 rounded-lg text-base font-semibold transition-colors',
          outOfStock
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : !allVariantsSelected
              ? 'bg-accent/50 text-accent-text cursor-not-allowed'
              : 'bg-accent text-accent-text hover:bg-accent-hover cursor-pointer',
        )}
      >
        {outOfStock
          ? 'Out of Stock'
          : !allVariantsSelected
            ? 'Select Options'
            : 'Add to Cart'}
      </button>

      {/* Buy now */}
      {!outOfStock && (
        <a
          href={`/${storeSlug}/checkout`}
          onClick={handleAddToCart}
          className="w-full h-12 rounded-lg text-base font-semibold border border-accent text-accent hover:bg-accent/5 transition-colors flex items-center justify-center"
        >
          Buy Now
        </a>
      )}
    </div>
  );
}