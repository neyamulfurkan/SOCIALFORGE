'use client';

import { create } from 'zustand';
import type { UIState, ToastItem } from '@/lib/types';

// ─────────────────────────────────────────────
// State + Actions shape
// ─────────────────────────────────────────────

type UIStoreState = UIState & {
  toasts: ToastItem[];
};

export type UIActions = {
  openDrawer: (type: 'product' | 'order' | 'post', id?: string) => void;
  closeDrawer: () => void;
  setChatbotOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setActiveOrderId: (id: string | null) => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
};

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useUIStore = create<UIStoreState & UIActions>()((set) => ({
  // ── Initial state ──────────────────────────
  drawerOpen: false,
  drawerType: null,
  drawerId: null,
  chatbotOpen: false,
  searchOpen: false,
  activeOrderId: null,
  toasts: [],

  // ── Drawer ────────────────────────────────
  openDrawer: (type, id) =>
    set({
      drawerOpen: true,
      drawerType: type,
      drawerId: id ?? null,
    }),

  closeDrawer: () =>
    set({
      drawerOpen: false,
      drawerType: null,
      drawerId: null,
    }),

  // ── Chatbot ───────────────────────────────
  setChatbotOpen: (open) => set({ chatbotOpen: open }),

  // ── Search ────────────────────────────────
  setSearchOpen: (open) => set({ searchOpen: open }),

  // ── Active order ──────────────────────────
  setActiveOrderId: (id) => set({ activeOrderId: id }),

  // ── Toasts ────────────────────────────────
  // Keeps a maximum of 5 toasts. Slices to the last 4 before
  // appending so that the total never exceeds 5.
  addToast: (toast) => {
    const id =
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [
        ...state.toasts.slice(-4),
        { ...toast, id },
      ],
    }));
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));