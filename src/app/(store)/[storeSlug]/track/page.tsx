'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TrackOrderPage({
  params: paramsPromise,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const params = React.use(paramsPromise);
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleTrack() {
    if (!phone.trim() && !orderNumber.trim()) {
      setError('Please enter your phone number or order number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const params2 = new URLSearchParams();
      if (phone.trim()) params2.set('phone', phone.trim());
      if (orderNumber.trim()) params2.set('orderNumber', orderNumber.trim().replace('#', ''));
      const res = await fetch(
        `/api/orders/track/${params.storeSlug}?` + params2.toString(),
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? 'No orders found. Please check your details.');
        return;
      }
      const json = await res.json();
      if (!json.data || json.data.length === 0) {
        setError('No orders found matching your details.');
        return;
      }
      // Navigate to results
      const query = new URLSearchParams();
      if (phone.trim()) query.set('phone', phone.trim());
      if (orderNumber.trim()) query.set('orderNumber', orderNumber.trim().replace('#', ''));
      router.push(`/${params.storeSlug}/track/results?` + query.toString());
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-store-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-[var(--color-store-text)] mb-1">
            Track Your Order
          </h1>
          <p className="text-sm text-center text-[var(--color-text-secondary)] mb-8">
            Enter your phone number or order number to see your order status.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-store-text)] mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full rounded-lg border border-[var(--color-store-border)] bg-[var(--color-store-bg)] px-4 py-2.5 text-sm text-[var(--color-store-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-colors"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--color-store-border)]" />
              <span className="text-xs text-[var(--color-text-tertiary)]">or</span>
              <div className="flex-1 h-px bg-[var(--color-store-border)]" />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-store-text)] mb-1.5">
                Order Number
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="#SFXXXXXXXXX"
                className="w-full rounded-lg border border-[var(--color-store-border)] bg-[var(--color-store-bg)] px-4 py-2.5 text-sm text-[var(--color-store-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              onClick={handleTrack}
              disabled={loading}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {loading ? 'Searching…' : 'Track Order'}
            </button>
          </div>
        </div>

        {/* Back link */}
        <p className="text-center mt-6">
          <a
            href={`/${params.storeSlug}`}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
          >
            ← Back to store
          </a>
        </p>
      </div>
    </div>
  );
}