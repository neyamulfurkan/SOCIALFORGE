'use client';

import { cn } from '@/lib/utils';
import { STATUS_LABELS, POST_STATUS_LABELS } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray';
export type BadgeSize = 'sm' | 'md';

export type BadgeProps = {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
};

export type StatusBadgeProps = {
  status: string;
  className?: string;
};

// ─── Variant and size class maps ──────────────────────────────────────────────

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-success/10 text-success',
  yellow: 'bg-warning/10 text-warning',
  red: 'bg-error/10 text-error',
  blue: 'bg-accent/10 text-accent',
  gray: 'bg-surface text-text-secondary',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

// ─── Status → variant mapping ─────────────────────────────────────────────────

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // Fulfillment
  NEW: 'blue',
  CONFIRMED: 'blue',
  PROCESSING: 'yellow',
  SHIPPED: 'blue',
  DELIVERED: 'green',
  CANCELLED: 'red',
  // Payment
  PENDING: 'yellow',
  PAID: 'green',
  FAILED: 'red',
  REFUNDED: 'red',
  // Product
  ACTIVE: 'green',
  DRAFT: 'gray',
  ARCHIVED: 'gray',
  // Post
  PENDING_REVIEW: 'yellow',
  SCHEDULED: 'blue',
  POSTING: 'yellow',
  LIVE: 'green',
  REJECTED: 'red',
  // Business
  SUSPENDED: 'red',
  // Plan
  TRIAL: 'yellow',
  STARTER: 'blue',
  PRO: 'green',
};

// ─── Badge ────────────────────────────────────────────────────────────────────

export default function Badge({
  variant = 'gray',
  size = 'sm',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant: BadgeVariant = STATUS_VARIANT_MAP[status] ?? 'gray';
  const label: string =
    STATUS_LABELS[status] ?? POST_STATUS_LABELS[status] ?? status;
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}