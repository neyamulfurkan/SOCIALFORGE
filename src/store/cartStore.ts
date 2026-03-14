'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CartItem, CartState } from '@/lib/types';

// ─────────────────────────────────────────────
// Store action types
// ─────────────────────────────────────────────

type CartActions = {
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantLabel?: string) => void;
  updateQuantity: (
    productId: string,
    variantLabel: string | undefined,
    quantity: number,
  ) => void;
  clearCart: () => void;
  setStore: (businessId: string, storeSlug: string) => void;
};

// ─────────────────────────────────────────────
// Identity helper
// Two cart items are the same iff productId AND variantLabel both match.
// undefined and missing variantLabel are treated as equivalent.
// ─────────────────────────────────────────────

function isSameItem(
  a: CartItem,
  productId: string,
  variantLabel: string | undefined,
): boolean {
  return (
    a.productId === productId &&
    (a.variantLabel ?? undefined) === (variantLabel ?? undefined)
  );
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useCartStore = create<CartState & CartActions>()(
  immer((set) => ({
    // ── Initial state ──────────────────────────
    items: [],
    businessId: '',
    storeSlug: '',

    // ── addItem ────────────────────────────────
    // If an item with the same productId + variantLabel already exists,
    // increment its quantity by the incoming item's quantity.
    // Otherwise append the new item.
    addItem: (item) =>
      set((state) => {
        const existing = state.items.find((i) =>
          isSameItem(i, item.productId, item.variantLabel),
        );
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          state.items.push(item);
        }
      }),

    // ── removeItem ─────────────────────────────
    // Remove the item that matches productId + variantLabel exactly.
    removeItem: (productId, variantLabel) =>
      set((state) => {
        state.items = state.items.filter(
          (i) => !isSameItem(i, productId, variantLabel),
        );
      }),

    // ── updateQuantity ─────────────────────────
    // Set quantity directly. If quantity <= 0 the item is removed.
    updateQuantity: (productId, variantLabel, quantity) =>
      set((state) => {
        if (quantity <= 0) {
          state.items = state.items.filter(
            (i) => !isSameItem(i, productId, variantLabel),
          );
        } else {
          const item = state.items.find((i) =>
            isSameItem(i, productId, variantLabel),
          );
          if (item) {
            item.quantity = quantity;
          }
        }
      }),

    // ── clearCart ──────────────────────────────
    clearCart: () =>
      set((state) => {
        state.items = [];
      }),

    // ── setStore ───────────────────────────────
    // Switch the active store. If the incoming businessId differs from the
    // current one, the cart is cleared first so items from one store are
    // never mixed with another.
    setStore: (businessId, storeSlug) =>
      set((state) => {
        if (state.businessId && state.businessId !== businessId) {
          state.items = [];
        }
        state.businessId = businessId;
        state.storeSlug = storeSlug;
      }),
  })),
);