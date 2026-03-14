'use client';

import type { CartItem } from '@/lib/types';
import { useCartStore } from '@/store/cartStore';



// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export function useCart(): {
  items: CartItem[];
  itemCount: number;
  displayCount: string;
  subtotal: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantLabel?: string) => void;
  updateQuantity: (productId: string, variantLabel: string | undefined, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string, variantLabel?: string) => boolean;
} {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);

  const rawCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const itemCount = Math.min(rawCount, 99);
  const displayCount = rawCount >= 99 ? '99+' : String(rawCount);

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.price) * i.quantity,
    0,
  );

  function isInCart(productId: string, variantLabel?: string): boolean {
    return items.some(
      (i) =>
        i.productId === productId &&
        (variantLabel === undefined || i.variantLabel === variantLabel),
    );
  }

  return {
    items,
    itemCount,
    displayCount,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    isInCart,
  };
}