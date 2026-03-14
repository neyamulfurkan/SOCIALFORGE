import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';
import type { Session } from 'next-auth';
import type { FulfillmentStatus } from '@prisma/client';
import { FULFILLMENT_STATUS_FLOW, ORDER_NUMBER_PREFIX } from '@/lib/constants';

export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}

export function formatPrice(
  amount: number | { toNumber?: () => number },
  currency = 'BDT',
): string {
  const num =
    typeof amount === 'number'
      ? amount
      : (amount as { toNumber: () => number }).toNumber();
  if (currency === 'BDT') {
    return '৳' + num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return '$' + num.toFixed(2);
}

export function generateSlug(name: string, withSuffix = false): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!withSuffix) return base;
  const suffix = Math.random().toString(36).substring(2, 6);
  return base + '-' + suffix;
}

export function generateOrderNumber(): string {
  return (
    ORDER_NUMBER_PREFIX +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  );
}

export function buildCloudinaryUrl(
  publicId: string,
  transform: string,
  width?: number,
): string {
  const widthSegment = width ? 'w_' + width + ',' : '';

  // If a full Cloudinary URL is passed, extract everything after /upload/
  // then strip any existing transform layers (segments containing underscores like v1234, w_x, c_fill)
  // so we only keep the real public ID path
  if (publicId.startsWith('http')) {
    const uploadMarker = '/upload/';
    const idx = publicId.indexOf(uploadMarker);
    if (idx === -1) return publicId; // not a recognised Cloudinary URL — use as-is

    const base = publicId.slice(0, idx + uploadMarker.length); // everything up to and including /upload/
    const afterUpload = publicId.slice(idx + uploadMarker.length); // e.g. "v1234567/folder/filename.jpg" or "c_fill,w_800/v1/folder/filename.jpg"

    // Split into path segments and drop any that look like transform or version segments
    // Transform segments contain underscores (w_800, c_fill, ar_3:4, f_auto, q_auto)
    // Version segments match /^v\d+$/
    const segments = afterUpload.split('/');
    const publicIdSegments = segments.filter((seg) => {
      if (/^v\d+$/.test(seg)) return false; // version segment e.g. v1234567
      if (seg.includes('_')) return false;   // transform segment e.g. w_800, c_fill
      return true;
    });

    const cleanPublicId = publicIdSegments.join('/');
    return base + widthSegment + transform + '/' + cleanPublicId;
  }

  // Bare public ID path
  const cloudName =
    typeof window === 'undefined'
      ? process.env.CLOUDINARY_CLOUD_NAME
      : process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  return (
    'https://res.cloudinary.com/' +
    cloudName +
    '/image/upload/' +
    widthSegment +
    transform +
    '/' +
    publicId
  );
}

export function getNextFulfillmentStatus(
  current: FulfillmentStatus,
): FulfillmentStatus | null {
  if (current === 'CANCELLED') return null;
  const index = FULFILLMENT_STATUS_FLOW.indexOf(current);
  if (index === -1 || index === FULFILLMENT_STATUS_FLOW.length - 1) return null;
  return FULFILLMENT_STATUS_FLOW[index + 1] as FulfillmentStatus;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function isBusinessOwner(session: Session | null): boolean {
  return session?.user?.role === 'BUSINESS_OWNER';
}

export function isSuperAdmin(session: Session | null): boolean {
  return session?.user?.role === 'SUPER_ADMIN';
}