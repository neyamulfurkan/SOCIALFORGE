'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from '@/components/ui/Toast';
import type {
  ProductWithVariants,
  OrderWithItems,
  ConversationWithMessages,
  DashboardStats,
  ActivityItem,
  PaginatedResponse,
  ApiResponse,
} from '@/lib/types';

// ─────────────────────────────────────────────
// Shared fetch helper — throws on non-OK responses
// ─────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Filter types
// ─────────────────────────────────────────────

export type ProductFilters = {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type OrderFilters = {
  status?: string;
  paymentStatus?: string;
  channel?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

// ─────────────────────────────────────────────
// QUERY HOOKS
// ─────────────────────────────────────────────

/**
 * Fetch all products for the authenticated business, with optional filters.
 */
export function useProducts(filters?: ProductFilters) {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;

  return useQuery<PaginatedResponse<ProductWithVariants>>({
    queryKey: ['products', businessId, filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.page != null) params.set('page', String(filters.page));
      if (filters?.pageSize != null) params.set('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return apiFetch(`/api/products${qs ? '?' + qs : ''}`, { signal });
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });
}

/**
 * Fetch paginated, server-filtered orders for the authenticated business.
 */
export function useOrders(filters?: OrderFilters) {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;

  return useQuery<PaginatedResponse<OrderWithItems>>({
    queryKey: ['orders', businessId, filters],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
      if (filters?.channel) params.set('channel', filters.channel);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.page != null) params.set('page', String(filters.page));
      if (filters?.pageSize != null) params.set('pageSize', String(filters.pageSize));
      const qs = params.toString();
      return apiFetch(`/api/orders${qs ? '?' + qs : ''}`, { signal });
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch a single order by ID.
 */
export function useOrder(id: string) {
  return useQuery<OrderWithItems | null>({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await apiFetch<ApiResponse<OrderWithItems>>(`/api/orders/${id}`);
      return res.data ?? null;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Fetch all Messenger conversations for the authenticated business, with 30s polling.
 */
export function useConversations() {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;

  return useQuery<ConversationWithMessages[]>({
    queryKey: ['conversations', businessId],
    queryFn: async () => {
      const res = await apiFetch<ApiResponse<ConversationWithMessages[]>>(
        '/api/messenger/conversations',
      );
      return res.data ?? [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch a single conversation's messages (for thread view).
 */
export function useConversationMessages(conversationId: string) {
  return useQuery<ConversationWithMessages | null>({
    queryKey: ['conversation-messages', conversationId],
    queryFn: async () => {
      const res = await apiFetch<ApiResponse<ConversationWithMessages>>(
        `/api/messenger/conversations/${conversationId}`,
      );
      return res.data ?? null;
    },
    enabled: !!conversationId,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

/**
 * Fetch social posts, optionally filtered by status.
 */
export function useSocialPosts(status?: string) {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;

  return useQuery({
    queryKey: ['social', businessId, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const qs = params.toString();
      const res = await apiFetch<ApiResponse<unknown[]>>(
        `/api/social${qs ? '?' + qs : ''}`,
      );
      return res.data ?? [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });
}

/**
 * Fetch analytics data for a date range.
 */
export function useAnalytics(
  dateRange: string,
  customFrom?: string,
  customTo?: string,
) {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;

  return useQuery({
    queryKey: ['analytics', businessId, dateRange, customFrom, customTo],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ range: dateRange });
      if (customFrom) params.set('from', customFrom);
      if (customTo) params.set('to', customTo);
      return apiFetch(`/api/orders/analytics?${params.toString()}`, { signal });
    },
    enabled: !!businessId,
    staleTime: 300_000,
  });
}

/**
 * Fetch dashboard stat cards data, with 60s polling.
 */
export function useDashboardStats(initialData?: DashboardStats) {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;

  return useQuery<DashboardStats>({
    queryKey: ['stats', businessId],
    queryFn: () => apiFetch<DashboardStats>('/api/orders/stats'),
    enabled: !!businessId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    ...(initialData ? { initialData } : {}),
  });
}

/**
 * Fetch the activity feed, with 30s polling.
 */
export function useActivityFeed(initialData?: ActivityItem[]) {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;

  return useQuery<ActivityItem[]>({
    queryKey: ['activity', businessId],
    queryFn: async () => {
      const res = await apiFetch<ApiResponse<ActivityItem[]>>('/api/orders/activity');
      return res.data ?? [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchInterval: 30_000,
    ...(initialData ? { initialData } : {}),
  });
}

// ─────────────────────────────────────────────
// MUTATION HOOKS
// ─────────────────────────────────────────────

/**
 * Create a new product.
 */
export function useCreateProduct() {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<ApiResponse<ProductWithVariants>>('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', businessId] });
      toast.success('Product created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Fully update an existing product by ID.
 */
export function useUpdateProduct(id: string) {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<ApiResponse<ProductWithVariants>>(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', businessId] });
      toast.success('Product updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Partially update a product (status change, stock update).
 */
export function usePatchProduct() {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFetch<ApiResponse<ProductWithVariants>>(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', businessId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Archive (soft-delete) a product.
 */
export function useArchiveProduct() {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', businessId] });
      toast.success('Product archived');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Advance or update an order's fulfillment status.
 */
export function useUpdateOrderStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<ApiResponse<OrderWithItems>>(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', id] });
      toast.success('Status updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Update internal notes on an order.
 */
export function useUpdateOrderNotes() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiFetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalNotes: notes }),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Send a human reply to a Messenger conversation from the dashboard.
 */
export function useSendMessengerReply() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: string; message: string }) =>
      apiFetch('/api/messenger/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message }),
      }),
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Update conversation status (resolve, star, flag).
 */
export function useUpdateConversationStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      status,
    }: {
      conversationId: string;
      status: string;
    }) =>
      apiFetch(`/api/messenger/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Approve (publish immediately) a social post.
 */
export function useApprovePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, facebookCaption, instagramCaption }: {
      postId: string;
      facebookCaption?: string;
      instagramCaption?: string;
    }) =>
      apiFetch('/api/social/approve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, facebookCaption, instagramCaption }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social'] });
      toast.success('Post published!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Schedule a social post for a future time.
 */
export function useSchedulePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      scheduledAt,
      facebookCaption,
      instagramCaption,
    }: {
      postId: string;
      scheduledAt: string;
      facebookCaption?: string;
      instagramCaption?: string;
    }) =>
      apiFetch('/api/social/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, scheduledAt, facebookCaption, instagramCaption }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social'] });
      toast.success('Post scheduled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Reject a pending social post.
 */
export function useRejectPost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) =>
      apiFetch('/api/social/reject', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social'] });
      toast.success('Post rejected');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Reschedule a social post to a new datetime.
 */
export function useReschedulePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) =>
      apiFetch('/api/social/reschedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, scheduledAt }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Regenerate captions for an existing social post.
 */
export function useRegeneratePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      tone,
      length,
    }: {
      postId: string;
      tone?: number;
      length?: string;
    }) =>
      apiFetch('/api/social/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, tone, length }),
      }),
    onSuccess: (_, { postId }) => {
      qc.invalidateQueries({ queryKey: ['social-post', postId] });
      qc.invalidateQueries({ queryKey: ['social'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─────────────────────────────────────────────
// LEGACY ALIASES
// These match the function names used in the GCD FILE-SPECIFIC PROMPT
// (non-hook naming convention) — re-exported as hooks for callers
// that followed the original spec names.
// ─────────────────────────────────────────────

/** @deprecated Prefer useCreateProduct */
export const createProduct = useCreateProduct;

/** @deprecated Prefer useUpdateProduct */
export const updateProduct = useUpdateProduct;

/** @deprecated Prefer useUpdateOrderStatus */
export const updateOrderStatus = useUpdateOrderStatus;

/** @deprecated Prefer useSendMessengerReply */
export const sendMessengerReply = useSendMessengerReply;

/** @deprecated Prefer useApprovePost */
export const approvePost = useApprovePost;

/** @deprecated Prefer useSchedulePost */
export const schedulePost = useSchedulePost;