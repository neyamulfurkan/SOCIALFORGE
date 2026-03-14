'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import type { ToastItem } from '@/lib/types';

// ─────────────────────────────────────────────
// toast utility object
// Calls useUIStore.getState().addToast() imperatively — safe to use outside
// React components (e.g. in mutation callbacks, event handlers, API utilities).
// ─────────────────────────────────────────────

export const toast = {
  success: (message: string, duration = 3000): void => {
    useUIStore.getState().addToast({ variant: 'success', message, duration });
  },
  error: (message: string, duration = 5000): void => {
    useUIStore.getState().addToast({ variant: 'error', message, duration });
  },
  warning: (message: string, duration = 4000): void => {
    useUIStore.getState().addToast({ variant: 'warning', message, duration });
  },
  info: (message: string, duration = 3000): void => {
    useUIStore.getState().addToast({ variant: 'info', message, duration });
  },
};

// ─────────────────────────────────────────────
// Variant styles
// ─────────────────────────────────────────────

const variantStyles: Record<ToastItem['variant'], string> = {
  success: 'border-l-4 border-success',
  error: 'border-l-4 border-error',
  warning: 'border-l-4 border-warning',
  info: 'border-l-4 border-accent',
};

const variantIconColor: Record<ToastItem['variant'], string> = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-accent',
};

// ─────────────────────────────────────────────
// Variant icons (inline SVG, no external library)
// ─────────────────────────────────────────────

function ToastIcon({ variant }: { variant: ToastItem['variant'] }) {
  const cls = cn('shrink-0 mt-0.5', variantIconColor[variant]);
  if (variant === 'success') {
    return (
      <svg className={cls} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (variant === 'error') {
    return (
      <svg className={cls} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </svg>
    );
  }
  if (variant === 'warning') {
    return (
      <svg className={cls} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  // info
  return (
    <svg className={cls} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Individual toast item
// ─────────────────────────────────────────────

function ToastItemComponent({ item }: { item: ToastItem }) {
  const removeToast = useUIStore((s) => s.removeToast);

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => removeToast(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ x: 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ opacity: 0, x: 80 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      role="alert"
      aria-live="polite"
      className={cn(
        'bg-surface rounded-lg shadow-elevated',
        'flex items-start gap-3 p-4 max-w-sm w-full',
        variantStyles[item.variant],
      )}
    >
      <ToastIcon variant={item.variant} />

      <p className="flex-1 text-sm text-text-primary leading-snug break-words">
        {item.message}
      </p>

      <button
        onClick={() => removeToast(item.id)}
        aria-label="Dismiss notification"
        className={cn(
          'shrink-0 text-text-tertiary hover:text-text-primary',
          'transition-colors rounded p-0.5 -mr-1 -mt-0.5',
        )}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Toaster — mount once in the root layout
// ─────────────────────────────────────────────

export default function Toaster() {
  const toasts = useUIStore((s) => s.toasts);

  // Show newest at bottom, cap at 5
  const visible = toasts.slice(-5);

  return (
    <div
      aria-label="Notifications"
      className={cn(
        'fixed z-[9999] flex flex-col gap-2 pointer-events-none',
        // Desktop: top-right. Mobile: top with horizontal margin.
        'top-4 right-4 left-4 md:left-auto',
      )}
    >
      <AnimatePresence mode="sync" initial={false}>
        {visible.map((t) => (
          <div key={t.id} className="pointer-events-auto ml-auto">
            <ToastItemComponent item={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}