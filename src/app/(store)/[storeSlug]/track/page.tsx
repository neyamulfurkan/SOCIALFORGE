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
      const query = new URLSearchParams();
      if (phone.trim()) query.set('phone', phone.trim());
      if (orderNumber.trim()) query.set('orderNumber', orderNumber.trim().replace('#', ''));

      const res = await fetch(`/api/orders/track/${params.storeSlug}?` + query.toString());
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error ?? 'No orders found. Please check your details.');
        return;
      }
      const json = await res.json() as { data?: unknown[] };
      if (!json.data || json.data.length === 0) {
        setError('No orders found matching your details.');
        return;
      }
      router.push(`/${params.storeSlug}/track/results?` + query.toString());
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    // No min-h-screen — StoreShell from the layout provides the full page chrome.
    // This component only renders the page content area.
    <div
      className="flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--color-store-bg)', minHeight: '70vh' }}
    >
      <div className="w-full max-w-md">

        {/* Card */}
        <div
          className="rounded-2xl p-8 border"
          style={{
            background: 'var(--color-store-surface)',
            borderColor: 'var(--color-store-border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-accent)' }}
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

          {/* Heading */}
          <h1
            className="text-2xl font-bold text-center mb-1"
            style={{ color: 'var(--color-store-text)' }}
          >
            Track Your Order
          </h1>
          <p
            className="text-sm text-center mb-8"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Enter your phone number or order number to see your order status.
          </p>

          <div className="space-y-4">
            {/* Phone field */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--color-store-text)' }}
              >
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                style={{
                  background: 'var(--color-store-bg)',
                  borderColor: 'var(--color-store-border)',
                  color: 'var(--color-store-text)',
                }}
                className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors
                  placeholder:opacity-40
                  focus:ring-2"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-store-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--color-store-border)' }} />
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--color-store-border)' }} />
            </div>

            {/* Order number field */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--color-store-text)' }}
              >
                Order Number
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="#SFXXXXXXXXX"
                style={{
                  background: 'var(--color-store-bg)',
                  borderColor: 'var(--color-store-border)',
                  color: 'var(--color-store-text)',
                }}
                className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors
                  placeholder:opacity-40"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-store-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
              />
            </div>

            {/* Error */}
            {error && (
              <p
                className="text-sm rounded-lg px-4 py-2.5 border"
                style={{
                  color: 'var(--color-error)',
                  background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--color-error) 25%, transparent)',
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleTrack}
              disabled={loading}
              className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Searching…
                </span>
              ) : (
                'Track Order'
              )}
            </button>
          </div>
        </div>

        {/* Back link */}
        <p className="text-center mt-6">
          <a
            href={`/${params.storeSlug}`}
            className="text-sm transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          >
            ← Back to store
          </a>
        </p>

      </div>
    </div>
  );
}