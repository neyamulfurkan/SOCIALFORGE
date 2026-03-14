import { prisma } from '@/lib/db';
import { formatPrice } from '@/lib/utils';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import type { PaymentMethod } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';

// ─────────────────────────────────────────────
// NEXT STEPS SECTION
// ─────────────────────────────────────────────

function NextStepsSection({ paymentMethod }: { paymentMethod: PaymentMethod }) {
  if (paymentMethod === 'BKASH') {
    return (
      <div className="mt-6 rounded-lg bg-pink-50 border border-pink-200 p-4">
        <h2 className="font-semibold text-pink-800 mb-1">Next Steps — bKash Payment</h2>
        <p className="text-sm text-pink-700">
          Please send your payment to the bKash number provided at checkout. Use your order
          number as the reference. Your order will be confirmed once payment is received.
        </p>
      </div>
    );
  }

  if (paymentMethod === 'NAGAD') {
    return (
      <div className="mt-6 rounded-lg bg-orange-50 border border-orange-200 p-4">
        <h2 className="font-semibold text-orange-800 mb-1">Next Steps — Nagad Payment</h2>
        <p className="text-sm text-orange-700">
          Please send your payment to the Nagad number provided at checkout. Use your order
          number as the reference. Your order will be confirmed once payment is received.
        </p>
      </div>
    );
  }

  if (paymentMethod === 'STRIPE') {
    return (
      <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
        <h2 className="font-semibold text-blue-800 mb-1">Payment Received</h2>
        <p className="text-sm text-blue-700">
          Your card payment has been processed. You will receive a confirmation email shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4">
      <h2 className="font-semibold text-green-800 mb-1">Next Steps — Cash on Delivery</h2>
      <p className="text-sm text-green-700">
        Please have the exact amount ready when our delivery team arrives. You will be
        contacted to confirm your delivery time.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { storeSlug } = await params;
  const { orderId } = await searchParams;

  let order = null;

  if (orderId) {
    const business = await prisma.business.findUnique({
      where: { slug: storeSlug },
      select: { id: true },
    });

    if (business) {
      order = await prisma.order.findFirst({
        where: { id: orderId, businessId: business.id },
        include: { items: { include: { product: true } } },
      });
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-store-bg)] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl p-8 shadow-[var(--shadow-card)]">
        {order ? (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-4">
                <svg
                  className="w-7 h-7 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-store-text)]">
                Order Placed!
              </h1>
              <p className="text-[var(--color-text-secondary)] mt-1">
                Order{' '}
                <span className="font-semibold text-[var(--color-store-text)]">
                  #{order.orderNumber}
                </span>
              </p>
            </div>

            {/* Customer info */}
            <div className="mb-5 text-sm text-[var(--color-store-text)]">
              <p>
                <span className="text-[var(--color-text-secondary)]">Name: </span>
                {order.customerName}
              </p>
              <p className="mt-0.5">
                <span className="text-[var(--color-text-secondary)]">Phone: </span>
                {order.customerPhone}
              </p>
              <p className="mt-0.5">
                <span className="text-[var(--color-text-secondary)]">Delivery to: </span>
                {order.deliveryAddress}
              </p>
            </div>

            {/* Order items */}
            <div className="space-y-3 mb-6">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 items-start">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      width={48}
                      height={48}
                      className="rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-[var(--color-store-border)] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--color-store-text)] leading-snug">
                      {item.productName}
                    </p>
                    {item.variantLabel && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        {item.variantLabel}
                      </p>
                    )}
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {formatPrice(Number(item.price))} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-store-text)] flex-shrink-0">
                    {formatPrice(Number(item.price) * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-[var(--color-store-border)] pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Subtotal</span>
                <span>{formatPrice(Number(order.subtotal))}</span>
              </div>
              <div className="flex justify-between text-[var(--color-text-secondary)]">
                <span>Delivery</span>
                <span>
                  {Number(order.deliveryCharge) === 0
                    ? 'Free'
                    : formatPrice(Number(order.deliveryCharge))}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base text-[var(--color-store-text)] pt-1 border-t border-[var(--color-store-border)]">
                <span>Total</span>
                <span>{formatPrice(Number(order.total))}</span>
              </div>
            </div>

            {/* Payment method */}
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Payment:{' '}
              <span className="font-medium text-[var(--color-store-text)]">
                {PAYMENT_METHOD_LABELS[order.paymentMethod]}
              </span>
            </p>

            {/* Next steps */}
            <NextStepsSection paymentMethod={order.paymentMethod} />

            {/* Track order CTA */}
            <div className="mt-6 rounded-lg border border-[var(--color-store-border)] p-4 flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-store-text)]">Track your order anytime</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Use your phone number or order number</p>
              </div>
              <Link
                href={`/${storeSlug}/track?orderNumber=${order.orderNumber}`}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                Track →
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-4">
              <svg
                className="w-7 h-7 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-store-text)]">
              Order Placed!
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-2">
              Thank you for your order. We&apos;ll process it soon.
            </p>
            <Link
              href={`/${storeSlug}/track`}
              className="inline-block mt-4 text-sm font-semibold px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              Track Your Order
            </Link>
          </div>
        )}

        {/* Footer links */}
        <div className="mt-8 flex items-center justify-between text-sm">
          <Link
            href={`/${storeSlug}`}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
          >
            ← Continue Shopping
          </Link>
          <Link
            href={`/${storeSlug}/track`}
            className="font-medium transition-colors"
            style={{ color: 'var(--color-accent)' }}
          >
            Track Orders
          </Link>
        </div>
      </div>
    </div>
  );
}