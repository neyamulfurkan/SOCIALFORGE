'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useChat } from 'ai/react';
import type { ProductWithVariants } from '@/lib/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StoreProductFilters = {
  category?: string;
  search?: string;
  page?: number;
};

type CreateOrderData = Record<string, unknown>;

type ChatbotStreamConfig = {
  id: string;
  slug: string;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function buildProductsUrl(storeSlug: string, filters?: StoreProductFilters): string {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  const qs = params.toString();
  return '/api/products/public/' + storeSlug + (qs ? '?' + qs : '');
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : undefined);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json;
}

// ─────────────────────────────────────────────
// useStoreProducts
// Fetch paginated/filtered product list for a public store.
// ─────────────────────────────────────────────

export function useStoreProducts(storeSlug: string, filters?: StoreProductFilters) {
  return useQuery({
    queryKey: ['store-products', storeSlug, filters],
    queryFn: async ({ signal }) => {
      const url = buildProductsUrl(storeSlug, filters);
      const json = await fetchJson<{ data?: ProductWithVariants[] }>(url, signal);
      return (json.data ?? []) as ProductWithVariants[];
    },
    enabled: !!storeSlug,
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────
// useProduct
// Fetch a single product by slug for the public store.
// ─────────────────────────────────────────────

export function useProduct(storeSlug: string, productSlug: string) {
  return useQuery({
    queryKey: ['store-product', storeSlug, productSlug],
    queryFn: async () => {
      const url = '/api/products/public/' + storeSlug + '/' + productSlug;
      const json = await fetchJson<{ data?: ProductWithVariants }>(url);
      if (!json.data) throw new Error('Product not found');
      return json.data as ProductWithVariants;
    },
    enabled: !!storeSlug && !!productSlug,
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────
// useSearchProducts
// Debounced-safe product search — only fires when query length > 1.
// Uses AbortController via TanStack Query signal to cancel stale requests.
// ─────────────────────────────────────────────

export function useSearchProducts(storeSlug: string, query: string) {
  return useQuery({
    queryKey: ['store-search', storeSlug, query],
    queryFn: async ({ signal }) => {
      const url =
        '/api/products/public/' +
        storeSlug +
        '?search=' +
        encodeURIComponent(query) +
        '&pageSize=20';
      const json = await fetchJson<{ data?: ProductWithVariants[] }>(url, signal);
      return (json.data ?? []) as ProductWithVariants[];
    },
    enabled: query.length > 1,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// ─────────────────────────────────────────────
// useCreateOrder
// Mutation for submitting a new order from the public store checkout.
// Throws a structured Error on non-OK responses so the caller can toast.
// ─────────────────────────────────────────────

export function useCreateOrder(_storeSlug: string) {
  return useMutation({
    mutationFn: async (orderData: CreateOrderData) => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to create order');
      }
      return json as { data?: { id: string; orderNumber: string } };
    },
  });
}

// ─────────────────────────────────────────────
// useChatbotStream
// Thin wrapper around the Vercel AI SDK useChat hook, pre-configured
// for the store chatbot endpoint with businessId and storeSlug in the body.
// ─────────────────────────────────────────────

export function useChatbotStream(storeConfig: ChatbotStreamConfig) {
  return useChat({
    api: '/api/ai/chat',
    body: {
      businessId: storeConfig.id,
      storeSlug: storeConfig.slug,
    },
  });
}