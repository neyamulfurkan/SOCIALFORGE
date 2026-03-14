'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OrderWithItems } from '@/lib/types';
import {
  STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  CHANNEL_LABELS,
  FULFILLMENT_STATUS_FLOW,
} from '@/lib/constants';
import {
  formatPrice,
  getNextFulfillmentStatus,
  formatRelativeTime,
  cn,
} from '@/lib/utils';
import type { FulfillmentStatus } from '@prisma/client';

// ─── Forward dependencies (not yet generated) ────────────────────────────────
//
// uiStore (FILE 080) — accessed via dynamic require + Zustand subscribe pattern.
// When FILE 080 is generated, replace useActiveOrderState() with:
//   import { useUIStore } from '@/store/uiStore';
//   const { activeOrderId, setActiveOrderId } = useUIStore();
//
// Drawer (FILE 074) — an inline DrawerShell is used below until FILE 074 exists.
// When FILE 074 is generated, replace DrawerShell with:
//   import Drawer from '@/components/ui/Drawer';
//
// Button (FILE 071) — already generated. Static import used directly.
//
// Badge (FILE 075) — an inline StatusPill is used below until FILE 075 exists.
// When FILE 075 is generated, replace StatusPill with:
//   import { StatusBadge } from '@/components/ui/Badge';  (or default Badge)
//
// ─────────────────────────────────────────────────────────────────────────────

import Button from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';

// ─── uiStore access ───────────────────────────────────────────────────────────

type UIStoreState = {
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;
};

function useActiveOrderState(): UIStoreState {
  const activeOrderId = useUIStore((s: { activeOrderId: string | null }) => s.activeOrderId);
  const setActiveOrderId = useUIStore((s: { setActiveOrderId: (id: string | null) => void }) => s.setActiveOrderId);
  return { activeOrderId, setActiveOrderId };
}

// ─── Inline DrawerShell (replaces FILE 074 until generated) ──────────────────
// FILE 074 expected props: { open, onClose, title, children, footer?, width? }
// When FILE 074 is generated, delete DrawerShell and swap the import.

type DrawerShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
};

function DrawerShell({ open, onClose, title, children, footer, width = 640 }: DrawerShellProps) {
  // Close on Escape
  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={handleKey}
        style={{ width: `min(${width}px, 100vw)` }}
        className="fixed right-0 top-0 h-full bg-surface z-50 flex flex-col shadow-elevated"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-border px-6 py-4">{footer}</div>
        )}
      </div>
    </>
  );
}

// ─── Inline StatusPill (replaces FILE 075 until generated) ───────────────────
// FILE 075 expected: default StatusBadge accepting { status: string }.
// When FILE 075 is generated, delete StatusPill and swap:
//   import Badge, { StatusBadge } from '@/components/ui/Badge';

function statusVariant(status: string): string {
  const green = new Set(['ACTIVE', 'DELIVERED', 'PAID', 'LIVE']);
  const yellow = new Set(['PROCESSING', 'PENDING', 'PENDING_REVIEW', 'CONFIRMED', 'SCHEDULED']);
  const red = new Set(['CANCELLED', 'FAILED', 'REFUNDED', 'REJECTED']);
  const blue = new Set(['SHIPPED', 'NEW']);
  if (green.has(status)) return 'bg-success/10 text-success';
  if (yellow.has(status)) return 'bg-warning/10 text-warning';
  if (red.has(status)) return 'bg-error/10 text-error';
  if (blue.has(status)) return 'bg-accent/10 text-accent';
  return 'bg-surface-raised text-text-secondary';
}

function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusVariant(status),
      )}
    >
      {label ?? status}
    </span>
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Status timeline ──────────────────────────────────────────────────────────

type StatusHistoryEntry = {
  status: string;
  timestamp: string;
  note?: string;
};

function StatusTimeline({
  current,
  history,
}: {
  current: string;
  history: StatusHistoryEntry[];
}) {
  const isCancelled = current === 'CANCELLED';
  const steps = isCancelled
    ? [...FULFILLMENT_STATUS_FLOW, 'CANCELLED']
    : FULFILLMENT_STATUS_FLOW;

  const currentIndex = steps.indexOf(current);

  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const reached = i <= currentIndex;
        const isCurrent = step === current;
        const entry = history.find((h) => h.status === step);

        return (
          <div key={step} className="flex gap-3">
            {/* Dot + connector */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-3 h-3 rounded-full border-2 shrink-0 mt-0.5',
                  isCurrent && step === 'CANCELLED'
                    ? 'border-error bg-error'
                    : isCurrent
                    ? 'border-accent bg-accent'
                    : reached
                    ? 'border-success bg-success'
                    : 'border-border bg-transparent',
                )}
              />
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 flex-1 my-1',
                    reached && i < currentIndex ? 'bg-success' : 'bg-border',
                  )}
                  style={{ minHeight: '20px' }}
                />
              )}
            </div>
            {/* Label + timestamp */}
            <div className="pb-4">
              <p
                className={cn(
                  'text-sm font-medium',
                  isCurrent && step === 'CANCELLED'
                    ? 'text-error'
                    : isCurrent
                    ? 'text-accent'
                    : reached
                    ? 'text-text-primary'
                    : 'text-text-tertiary',
                )}
              >
                {STATUS_LABELS[step] ?? step}
              </p>
              {entry && (
                <p className="text-xs text-text-secondary mt-0.5">
                  {formatRelativeTime(new Date(entry.timestamp))}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Order items ──────────────────────────────────────────────────────────────

function OrderItemRow({
  item,
}: {
  item: OrderWithItems['items'][number];
}) {
  const price = Number(item.price);

  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-0">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.productName}
          width={40}
          height={40}
          className="w-10 h-10 rounded object-cover bg-surface-raised shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-surface-raised shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {item.productName}
        </p>
        {item.variantLabel && (
          <p className="text-xs text-text-secondary">{item.variantLabel}</p>
        )}
        <p className="text-xs text-text-secondary">Qty: {item.quantity}</p>
      </div>
      <p className="text-sm font-medium text-text-primary tabular-nums shrink-0">
        {formatPrice(price * item.quantity)}
      </p>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-surface-raised rounded w-40" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-surface-raised rounded w-24" />
          <div className="h-4 bg-surface-raised rounded w-full" />
          <div className="h-4 bg-surface-raised rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OrderPanel() {
  const { activeOrderId, setActiveOrderId } = useActiveOrderState();
  const queryClient = useQueryClient();

  // Internal notes state
  const [notes, setNotes] = useState('');
  const [notesInitialized, setNotesInitialized] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setActiveOrderId(null);
    setNotesInitialized(false);
    setNotes('');
  }, [setActiveOrderId]);

  // Fetch order
  const { data: order, isLoading } = useQuery<OrderWithItems>({
    queryKey: ['order', activeOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${activeOrderId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch order');
      const json = await res.json();
      return json.data;
    },
    enabled: !!activeOrderId,
    staleTime: 30_000,
  });

  // Sync notes from fetched order (once)
  if (order && !notesInitialized) {
    setNotes(order.internalNotes ?? '');
    setNotesInitialized(true);
  }

  // Advance status mutation
  const advanceMutation = useMutation({
    mutationFn: async (status: FulfillmentStatus) => {
      const res = await fetch(`/api/orders/${activeOrderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', activeOrderId] });
      setNotesInitialized(false);
    },
    onError: () => {
      // toast.error not available until FILE 073 — fall back to console
      console.error('[OrderPanel] Status advance failed');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${activeOrderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!res.ok) throw new Error('Failed to cancel order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', activeOrderId] });
      setNotesInitialized(false);
    },
  });

  // Debounced notes save
  const saveNotes = useCallback(
    (value: string) => {
      if (!activeOrderId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/orders/${activeOrderId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ internalNotes: value }),
          });
          queryClient.invalidateQueries({ queryKey: ['order', activeOrderId] });
        } catch {
          console.error('[OrderPanel] Notes save failed');
        }
      }, 500);
    },
    [activeOrderId, queryClient],
  );

  // Copy order summary
  const handleCopy = useCallback(async () => {
    if (!order) return;
    const total = Number(order.total);
    const lines = [
      `Order #${order.orderNumber}`,
      `Customer: ${order.customerName}`,
      `Phone: ${order.customerPhone}`,
      order.customerEmail ? `Email: ${order.customerEmail}` : null,
      `Address: ${order.deliveryAddress}`,
      `Payment: ${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}`,
      `Status: ${STATUS_LABELS[order.fulfillmentStatus] ?? order.fulfillmentStatus}`,
      `Total: ${formatPrice(total)}`,
      '',
      'Items:',
      ...order.items.map(
        (it) =>
          `  ${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ''} × ${it.quantity}`,
      ),
    ]
      .filter((l) => l !== null)
      .join('\n');
    await navigator.clipboard.writeText(lines);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [order]);

  // Derived values
  const nextStatus = order
    ? getNextFulfillmentStatus(order.fulfillmentStatus as FulfillmentStatus)
    : null;
  const isCancelled = order?.fulfillmentStatus === 'CANCELLED';
  const isDelivered = order?.fulfillmentStatus === 'DELIVERED';
  const isTerminal = isCancelled || isDelivered;

  const subtotal = order ? Number(order.subtotal) : 0;
  const deliveryCharge = order ? Number(order.deliveryCharge) : 0;
  const total = order ? Number(order.total) : 0;

  const statusHistory: StatusHistoryEntry[] = Array.isArray(order?.statusHistory)
    ? (order.statusHistory as StatusHistoryEntry[])
    : [];

  // Footer actions
  const footer = order ? (
    <div className="flex flex-wrap gap-2">
      {!isTerminal && nextStatus && (
        <Button
          size="sm"
          variant="primary"
          loading={advanceMutation.isPending}
          onClick={() => advanceMutation.mutate(nextStatus as FulfillmentStatus)}
        >
          Advance to {STATUS_LABELS[nextStatus] ?? nextStatus}
        </Button>
      )}
      {!isTerminal && (
        <Button
          size="sm"
          variant="secondary"
          loading={cancelMutation.isPending}
          onClick={() => {
            if (window.confirm('Cancel this order?')) {
              cancelMutation.mutate();
            }
          }}
        >
          Cancel Order
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCopy}
        className="ml-auto flex items-center gap-1.5"
      >
        {copyDone ? <CheckIcon /> : <CopyIcon />}
        {copyDone ? 'Copied' : 'Copy'}
      </Button>
    </div>
  ) : null;

  return (
    <DrawerShell
      open={!!activeOrderId}
      onClose={close}
      title={order ? `Order #${order.orderNumber}` : 'Order Detail'}
      footer={footer}
      width={640}
    >
      {isLoading || !order ? (
        <PanelSkeleton />
      ) : (
        <>
          {/* Cancelled banner */}
          {isCancelled && (
            <div className="mb-6 rounded-md bg-error/10 border border-error/20 px-4 py-3">
              <p className="text-sm font-medium text-error">This order has been cancelled.</p>
            </div>
          )}

          {/* Header meta */}
          <div className="flex items-center gap-2 mb-6">
            <StatusPill
              status={order.channel}
              label={CHANNEL_LABELS[order.channel] ?? order.channel}
            />
            <StatusPill
              status={order.fulfillmentStatus}
              label={STATUS_LABELS[order.fulfillmentStatus] ?? order.fulfillmentStatus}
            />
            <StatusPill
              status={order.paymentStatus}
              label={order.paymentStatus.charAt(0) + order.paymentStatus.slice(1).toLowerCase()}
            />
          </div>

          {/* Customer */}
          <Section title="Customer">
            <div className="space-y-1 text-sm">
              <p className="text-text-primary font-medium">{order.customerName}</p>
              <p className="text-text-secondary">{order.customerPhone}</p>
              {order.customerEmail && (
                <p className="text-text-secondary">{order.customerEmail}</p>
              )}
              <p className="text-text-secondary mt-2">{order.deliveryAddress}</p>
            </div>
          </Section>

          {/* Items */}
          <Section title="Items">
            <div>
              {order.items.map((item) => (
                <OrderItemRow key={item.id} item={item} />
              ))}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Delivery</span>
                <span className="tabular-nums">
                  {deliveryCharge === 0 ? 'Free' : formatPrice(deliveryCharge)}
                </span>
              </div>
              <div className="flex justify-between text-text-primary font-semibold pt-1 border-t border-border">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(total)}</span>
              </div>
            </div>
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Method:</span>
                <span className="text-text-primary">
                  {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-secondary">Status:</span>
                <StatusPill status={order.paymentStatus} />
              </div>
              {order.transactionId && (
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary">Tx ID:</span>
                  <span className="text-text-primary font-mono text-xs bg-surface-raised px-2 py-0.5 rounded">
                    {order.transactionId}
                  </span>
                </div>
              )}
            </div>
          </Section>

          {/* Status timeline */}
          <Section title="Status Timeline">
            <StatusTimeline
              current={order.fulfillmentStatus}
              history={statusHistory}
            />
          </Section>

          {/* Internal notes */}
          <Section title="Internal Notes">
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
              onBlur={() => saveNotes(notes)}
              placeholder="Add a private note about this order…"
              rows={3}
              className={cn(
                'w-full bg-surface border border-border rounded-md px-3 py-2 text-sm resize-none',
                'text-text-primary placeholder:text-text-tertiary',
                'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
              )}
            />
            <p className="text-xs text-text-tertiary mt-1">Saved automatically on blur</p>
          </Section>

          {/* Created at */}
          <p className="text-xs text-text-tertiary">
            Placed {formatRelativeTime(new Date(order.createdAt))}
          </p>
        </>
      )}
    </DrawerShell>
  );
}