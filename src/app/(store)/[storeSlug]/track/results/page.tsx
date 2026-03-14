'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string;
  productName: string;
  variantLabel?: string | null;
  quantity: number;
  price: number;
  imageUrl?: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  deliveryCharge: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  statusHistory: Array<{ status: string; timestamp: string; note?: string }>;
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  NEW:        { label: 'Order Placed',   color: '#6366f1', bg: '#eef2ff', icon: '📋' },
  CONFIRMED:  { label: 'Confirmed',      color: '#0891b2', bg: '#ecfeff', icon: '✅' },
  PROCESSING: { label: 'Processing',     color: '#d97706', bg: '#fffbeb', icon: '⚙️' },
  SHIPPED:    { label: 'Shipped',        color: '#7c3aed', bg: '#f5f3ff', icon: '🚚' },
  DELIVERED:  { label: 'Delivered',      color: '#16a34a', bg: '#f0fdf4', icon: '🎉' },
  CANCELLED:  { label: 'Cancelled',      color: '#dc2626', bg: '#fef2f2', icon: '❌' },
};

const PAYMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: 'Pending',  color: '#d97706', bg: '#fffbeb' },
  PAID:     { label: 'Paid',     color: '#16a34a', bg: '#f0fdf4' },
  FAILED:   { label: 'Failed',   color: '#dc2626', bg: '#fef2f2' },
  REFUNDED: { label: 'Refunded', color: '#6366f1', bg: '#eef2ff' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  STRIPE: 'Card',
  COD: 'Cash on Delivery',
};

const FLOW = ['NEW', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

function formatPrice(amount: number) {
  return '৳' + Number(amount).toLocaleString('en-BD');
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span className="text-xs text-gray-500">{status}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

function PaymentPill({ status }: { status: string }) {
  const cfg = PAYMENT_CONFIG[status];
  if (!cfg) return <span className="text-xs text-gray-500">{status}</span>;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Progress tracker ─────────────────────────────────────────────────────────

function OrderProgress({ status }: { status: string }) {
  const isCancelled = status === 'CANCELLED';
  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-red-50 rounded-lg border border-red-200">
        <span className="text-red-500 text-lg">❌</span>
        <span className="text-sm font-medium text-red-700">This order has been cancelled.</span>
      </div>
    );
  }

  const currentIndex = FLOW.indexOf(status);

  return (
    <div className="relative">
      {/* Line */}
      <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
      <div
        className="absolute top-4 left-4 h-0.5 bg-green-500 transition-all duration-500"
        style={{
          width: currentIndex <= 0 ? '0%' : `${(currentIndex / (FLOW.length - 1)) * (100 - 8)}%`,
        }}
      />
      {/* Steps */}
      <div className="relative flex justify-between">
        {FLOW.map((step, i) => {
          const reached = i <= currentIndex;
          const isCurrent = i === currentIndex;
          const cfg = STATUS_CONFIG[step];
          return (
            <div key={step} className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all duration-300 bg-white"
                style={{
                  borderColor: reached ? (isCurrent ? cfg?.color : '#16a34a') : '#e5e7eb',
                  backgroundColor: reached ? (isCurrent ? cfg?.bg : '#f0fdf4') : 'white',
                }}
              >
                {reached ? (isCurrent ? cfg?.icon : '✓') : ''}
              </div>
              <span
                className="text-xs font-medium text-center hidden sm:block"
                style={{ color: reached ? (isCurrent ? cfg?.color : '#16a34a') : '#9ca3af' }}
              >
                {cfg?.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Single order card ────────────────────────────────────────────────────────

function OrderCard({ order, storeSlug }: { order: Order; storeSlug: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-[var(--color-store-border)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start gap-3 justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Order Number</p>
          <p className="font-bold text-[var(--color-store-text)] text-base tracking-wide">
            #{order.orderNumber}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={order.fulfillmentStatus} />
          <PaymentPill status={order.paymentStatus} />
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 py-5 border-b border-gray-100">
        <OrderProgress status={order.fulfillmentStatus} />
      </div>

      {/* Summary row */}
      <div className="px-5 py-4 flex flex-wrap gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Items</p>
          <p className="font-medium text-[var(--color-store-text)]">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Total</p>
          <p className="font-bold" style={{ color: 'var(--color-accent)' }}>
            {formatPrice(Number(order.total))}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Payment</p>
          <p className="font-medium text-[var(--color-store-text)]">
            {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-xs font-semibold transition-colors"
          style={{ color: 'var(--color-accent)' }}
        >
          {expanded ? 'Hide details ▲' : 'View details ▼'}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5 bg-gray-50">
          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Items Ordered
            </p>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 items-start">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-store-text)] truncate">
                      {item.productName}
                    </p>
                    {item.variantLabel && (
                      <p className="text-xs text-gray-500">{item.variantLabel}</p>
                    )}
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-store-text)] shrink-0">
                    {formatPrice(Number(item.price) * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery</span>
              <span>
                {Number(order.deliveryCharge) === 0 ? 'Free' : formatPrice(Number(order.deliveryCharge))}
              </span>
            </div>
            <div className="flex justify-between font-bold text-base text-[var(--color-store-text)] border-t border-gray-200 pt-2">
              <span>Total</span>
              <span style={{ color: 'var(--color-accent)' }}>
                {formatPrice(Number(order.total))}
              </span>
            </div>
          </div>

          {/* Delivery address */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Delivery Address
            </p>
            <p className="text-sm text-[var(--color-store-text)]">{order.deliveryAddress}</p>
          </div>

          {/* Status history */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Order History
              </p>
              <div className="space-y-2">
                {[...order.statusHistory].reverse().map((entry, i) => {
                  const cfg = STATUS_CONFIG[entry.status];
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-base mt-0.5">{cfg?.icon ?? '•'}</span>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-store-text)]">
                          {cfg?.label ?? entry.status}
                        </p>
                        <p className="text-xs text-gray-400">{formatDate(entry.timestamp)}</p>
                        {entry.note && (
                          <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function TrackResultsInner({
  storeSlug,
}: {
  storeSlug: string;
}) {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const orderNumber = searchParams.get('orderNumber') ?? '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchOrders() {
      try {
        const query = new URLSearchParams();
        if (phone) query.set('phone', phone);
        if (orderNumber) query.set('orderNumber', orderNumber);
        const res = await fetch(`/api/orders/track/${storeSlug}?` + query.toString());
        if (!res.ok) {
          setError('No orders found. Please check your details.');
          return;
        }
        const json = await res.json();
        setOrders(json.data ?? []);
      } catch {
        setError('Failed to load orders. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [phone, orderNumber, storeSlug]);

  return (
    <div className="min-h-screen bg-[var(--color-store-bg)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-store-text)]">Your Orders</h1>
            {phone && (
              <p className="text-sm text-gray-500 mt-0.5">Phone: {phone}</p>
            )}
          </div>
          <Link
            href={`/${storeSlug}/track`}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--color-accent)' }}
          >
            ← Search again
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-40 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <p className="text-red-500 text-base font-medium mb-4">{error}</p>
            <Link
              href={`/${storeSlug}/track`}
              className="inline-block px-6 py-2.5 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Try Again
            </Link>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-[var(--color-store-text)] font-medium mb-1">No orders found</p>
            <p className="text-sm text-gray-500 mb-4">
              We couldn&apos;t find any orders matching your details.
            </p>
            <Link
              href={`/${storeSlug}/track`}
              className="inline-block px-6 py-2.5 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Search Again
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {orders.length} order{orders.length !== 1 ? 's' : ''} found
            </p>
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} storeSlug={storeSlug} />
            ))}
          </div>
        )}

        {/* Continue shopping */}
        <div className="mt-8 text-center">
          <Link
            href={`/${storeSlug}`}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TrackResultsPage({
  params: paramsPromise,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const params = React.use(paramsPromise);
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-store-bg)] py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-40 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-full mb-2" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    }>
      <TrackResultsInner storeSlug={params.storeSlug} />
    </Suspense>
  );
}