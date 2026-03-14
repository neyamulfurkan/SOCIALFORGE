'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input, { Textarea } from '@/components/ui/Input';
import { formatPrice } from '@/lib/utils';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';

// ─────────────────────────────────────────────
// Forward-dependency stubs
// These are replaced when FILE 079 and FILE 080 are generated.
// ─────────────────────────────────────────────

import { useCartStore } from '@/store/cartStore';

type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  slug: string;
  variantLabel?: string | null;
};

function useCartItems(): CartItem[] {
  return useCartStore((s) => s.items);
}

function useClearCart(): () => void {
  return useCartStore((s) => s.clearCart);
}

import { useUIStore } from '@/store/uiStore';

function useAddToast(): (toast: Omit<ToastItem, 'id'>) => void {
  return useUIStore((s) => s.addToast);
}

// ─────────────────────────────────────────────
// Inline types (subset of lib/types.ts to avoid server imports)
// ─────────────────────────────────────────────



type ToastItem = {
  id: string;
  variant: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

type PaymentConfig = {
  cashOnDelivery: boolean;
  bkashNumber: string | null;
  bkashInstructions: string | null;
  nagadNumber: string | null;
  nagadInstructions: string | null;
  stripePublicKey: string | null;
  deliveryCharge: number;
  freeDeliveryThreshold: number | null;
};

type CheckoutFormProps = {
  businessId: string;
  storeSlug: string;
  paymentConfig: PaymentConfig;
};

type PaymentMethod = '' | 'BKASH' | 'NAGAD' | 'STRIPE' | 'COD';

type FormErrors = Record<string, string>;

// ─────────────────────────────────────────────
// Phone validation helper
// ─────────────────────────────────────────────

function isValidPhone(phone: string): boolean {
  const bd = /^01[3-9]\d{8}$/.test(phone.replace(/\s/g, ''));
  const intl = phone.replace(/[\s\-+]/g, '').length >= 10;
  return bd || intl;
}

// ─────────────────────────────────────────────
// Payment method card
// ─────────────────────────────────────────────

type PaymentCardProps = {
  id: PaymentMethod;
  label: string;
  selected: boolean;
  onSelect: (id: PaymentMethod) => void;
  logo?: React.ReactNode;
};

function PaymentCard({ id, label, selected, onSelect, logo }: PaymentCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={[
        'flex items-center gap-3 w-full rounded-md border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-accent bg-accent/5 text-store-text'
          : 'border-store-border bg-store-surface text-store-text hover:border-accent/50',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-4 w-4 shrink-0 rounded-full border-2 items-center justify-center',
          selected ? 'border-accent' : 'border-store-border',
        ].join(' ')}
      >
        {selected && (
          <span className="block h-2 w-2 rounded-full bg-accent" />
        )}
      </span>
      {logo && <span className="shrink-0">{logo}</span>}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// Order summary panel
// ─────────────────────────────────────────────

type OrderSummaryProps = {
  items: CartItem[];
// CartItem defined above
  deliveryCharge: number;
  freeDeliveryThreshold: number | null;
};

function OrderSummary({ items, deliveryCharge, freeDeliveryThreshold }: OrderSummaryProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isFreeDelivery =
    freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold;
  const effectiveDelivery = isFreeDelivery ? 0 : deliveryCharge;
  const total = subtotal + effectiveDelivery;

  return (
    <div className="bg-store-surface border border-store-border rounded-lg p-5 space-y-4">
      <h2 className="font-semibold text-store-text text-base">Order Summary</h2>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.productId + (item.variantLabel ?? '')}
            className="flex gap-3 items-start"
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.productName}
                className="h-12 w-9 object-cover rounded shrink-0"
              />
            ) : (
              <div className="h-12 w-9 bg-store-border rounded shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-store-text line-clamp-1">
                {item.productName}
              </p>
              {item.variantLabel && (
                <p className="text-xs text-text-secondary">{item.variantLabel}</p>
              )}
              <p className="text-xs text-text-secondary">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-medium text-store-text shrink-0">
              {formatPrice(item.price * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t border-store-border pt-3 space-y-2 text-sm">
        <div className="flex justify-between text-store-text">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-store-text">
          <span>Delivery</span>
          <span>
            {isFreeDelivery ? (
              <span className="text-green-600 font-medium">Free</span>
            ) : (
              formatPrice(effectiveDelivery)
            )}
          </span>
        </div>
        {freeDeliveryThreshold !== null && !isFreeDelivery && (
          <p className="text-xs text-text-secondary">
            Add {formatPrice(freeDeliveryThreshold - subtotal)} more for free delivery
          </p>
        )}
        <div className="flex justify-between font-semibold text-base text-store-text border-t border-store-border pt-2">
          <span>Total</span>
          <span style={{ color: 'var(--color-accent)' }}>{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function CheckoutForm({
  businessId,
  storeSlug,
  paymentConfig,
}: CheckoutFormProps) {
  const router = useRouter();
  const items = useCartItems();
  const clearCart = useClearCart();
  const addToast = useAddToast();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Redirect if cart is empty (only before a successful order is placed)
  useEffect(() => {
    if (items.length === 0 && !loading) {
      router.push('/' + storeSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only on mount — post-order redirect is handled in handleSubmit

  // ── Derived values ──────────────────────────

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isFreeDelivery =
    paymentConfig.freeDeliveryThreshold !== null &&
    subtotal >= paymentConfig.freeDeliveryThreshold;
  const effectiveDelivery = isFreeDelivery ? 0 : paymentConfig.deliveryCharge;
  const total = subtotal + effectiveDelivery;

  // ── Available payment methods ───────────────

  type MethodDef = { id: PaymentMethod; label: string };
  const availableMethods: MethodDef[] = [];

  if (paymentConfig.bkashNumber) {
    availableMethods.push({ id: 'BKASH', label: PAYMENT_METHOD_LABELS.BKASH });
  }
  if (paymentConfig.nagadNumber) {
    availableMethods.push({ id: 'NAGAD', label: PAYMENT_METHOD_LABELS.NAGAD });
  }
  if (paymentConfig.stripePublicKey) {
    availableMethods.push({ id: 'STRIPE', label: PAYMENT_METHOD_LABELS.STRIPE });
  }
  if (paymentConfig.cashOnDelivery) {
    availableMethods.push({ id: 'COD', label: PAYMENT_METHOD_LABELS.COD });
  }

  // ── Validation ──────────────────────────────

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!customerName.trim()) errs.customerName = 'Name is required.';
    if (!customerPhone.trim()) {
      errs.customerPhone = 'Phone number is required.';
    } else if (!isValidPhone(customerPhone)) {
      errs.customerPhone = 'Enter a valid phone number.';
    }
    if (!deliveryAddress.trim()) errs.deliveryAddress = 'Delivery address is required.';
    if (!paymentMethod) errs.paymentMethod = 'Please select a payment method.';
    if ((paymentMethod === 'BKASH' || paymentMethod === 'NAGAD') && !transactionId.trim()) {
      errs.transactionId = 'Transaction ID is required for this payment method.';
    }
    return errs;
  }

  // ── Submit ──────────────────────────────────

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || undefined,
          deliveryAddress: deliveryAddress.trim(),
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            variantLabel: i.variantLabel,
          })),
          paymentMethod,
          transactionId: transactionId.trim() || undefined,
          channel: 'WEBSITE',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        addToast({
          variant: 'error',
          message: json.error ?? 'Failed to place order. Please try again.',
          duration: 5000,
        });
        return;
      }

      clearCart();
      router.push('/' + storeSlug + '/order-confirmation?orderId=' + json.data?.id);
    } catch {
      addToast({
        variant: 'error',
        message: 'Network error. Please check your connection and try again.',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────

  if (items.length === 0 && !loading) {
    return null; // Redirect in progress
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-store-text mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ── Left: form ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Customer info */}
          <section className="bg-store-surface border border-store-border rounded-lg p-5 space-y-4">
            <h2 className="font-semibold text-store-text">Your Details</h2>
            <Input
              label="Full Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              error={errors.customerName}
              placeholder="Enter your full name"
              className="bg-store-surface border-store-border text-store-text placeholder:text-text-tertiary"
            />
            <Input
              label="Phone Number"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              error={errors.customerPhone}
              placeholder="01XXXXXXXXX"
              className="bg-store-surface border-store-border text-store-text placeholder:text-text-tertiary"
            />
            <Input
              label="Email (optional)"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-store-surface border-store-border text-store-text placeholder:text-text-tertiary"
            />
            <Textarea
              label="Delivery Address"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              error={errors.deliveryAddress}
              placeholder="House no., road, area, district"
              rows={3}
              className="bg-store-surface border-store-border text-store-text placeholder:text-text-tertiary"
            />
          </section>

          {/* Payment method */}
          <section className="bg-store-surface border border-store-border rounded-lg p-5 space-y-3">
            <h2 className="font-semibold text-store-text">Payment Method</h2>

            {availableMethods.length === 0 && (
              <p className="text-sm text-text-secondary">
                No payment methods are currently configured for this store.
              </p>
            )}

            <div className="space-y-2">
              {availableMethods.map((m) => (
                <PaymentCard
                  key={m.id}
                  id={m.id}
                  label={m.label}
                  selected={paymentMethod === m.id}
                  onSelect={setPaymentMethod}
                />
              ))}
            </div>

            {errors.paymentMethod && (
              <p className="text-sm text-error">{errors.paymentMethod}</p>
            )}

            {/* bKash detail */}
            {paymentMethod === 'BKASH' && (
              <div className="mt-3 rounded-md bg-pink-50 border border-pink-200 p-4 space-y-3">
                <p className="text-sm font-medium text-pink-800">
                  Send payment to bKash number:{' '}
                  <span className="font-bold tracking-wide">
                    {paymentConfig.bkashNumber}
                  </span>
                </p>
                {paymentConfig.bkashInstructions && (
                  <p className="text-sm text-pink-700 whitespace-pre-line">
                    {paymentConfig.bkashInstructions}
                  </p>
                )}
                <Input
                  label="bKash Transaction ID"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  error={errors.transactionId}
                  placeholder="e.g. 8N7A3X1K2P"
                  className="bg-white border-pink-200 text-store-text"
                />
              </div>
            )}

            {/* Nagad detail */}
            {paymentMethod === 'NAGAD' && (
              <div className="mt-3 rounded-md bg-orange-50 border border-orange-200 p-4 space-y-3">
                <p className="text-sm font-medium text-orange-800">
                  Send payment to Nagad number:{' '}
                  <span className="font-bold tracking-wide">
                    {paymentConfig.nagadNumber}
                  </span>
                </p>
                {paymentConfig.nagadInstructions && (
                  <p className="text-sm text-orange-700 whitespace-pre-line">
                    {paymentConfig.nagadInstructions}
                  </p>
                )}
                <Input
                  label="Nagad Transaction ID"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  error={errors.transactionId}
                  placeholder="e.g. TXN123456"
                  className="bg-white border-orange-200 text-store-text"
                />
              </div>
            )}

            {/* COD detail */}
            {paymentMethod === 'COD' && (
              <div className="mt-3 rounded-md bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-800">
                  Pay in cash when your order is delivered. No advance payment required.
                </p>
              </div>
            )}

            {/* Stripe placeholder */}
            {paymentMethod === 'STRIPE' && (
              <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm text-blue-800 font-medium">Card Payment</p>
                <p className="text-sm text-blue-700 mt-1">
                  Secure card payment is coming soon. Please choose another payment method for now.
                </p>
              </div>
            )}
          </section>

          {/* Mobile order summary */}
          <div className="lg:hidden">
            <OrderSummary
              items={items}
              deliveryCharge={paymentConfig.deliveryCharge}
              freeDeliveryThreshold={paymentConfig.freeDeliveryThreshold}
            />
          </div>

          {/* Submit */}
          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              onClick={handleSubmit}
              className="w-full"
            >
              Place Order — {formatPrice(total)}
            </Button>
            <p className="text-xs text-center text-text-secondary">
              By placing your order you agree to our terms of service.
            </p>
          </div>
        </div>

        {/* ── Right: order summary (desktop) ── */}
        <div className="hidden lg:block lg:col-span-2">
          <div className="sticky top-6">
            <OrderSummary
              items={items}
              deliveryCharge={paymentConfig.deliveryCharge}
              freeDeliveryThreshold={paymentConfig.freeDeliveryThreshold}
            />
          </div>
        </div>
      </div>
    </div>
  );
}