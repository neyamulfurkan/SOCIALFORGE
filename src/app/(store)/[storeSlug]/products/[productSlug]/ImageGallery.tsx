'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type ImageGalleryProps = {
  images: string[];
  productName: string;
  discount: number | null;
  outOfStock: boolean;
};

export default function ImageGallery({
  images,
  productName,
  discount,
  outOfStock,
}: ImageGalleryProps): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const hasImages = images.length > 0;
  const currentSrc = hasImages ? images[currentIndex] : null;

  function goToPrev(): void {
    setCurrentIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }

  function goToNext(): void {
    setCurrentIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>): void {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>): void {
    if (touchStartXRef.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStartXRef.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) goToNext();
      else goToPrev();
    }
    touchStartXRef.current = null;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Primary image */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-store-surface border border-store-border select-none"
        style={{ aspectRatio: '4/5' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentSrc ? (
          <Image
            src={currentSrc}
            alt={`${productName} — image ${currentIndex + 1}`}
            fill
            priority={currentIndex === 0}
            className="object-cover transition-opacity duration-200"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-20 h-20"
              style={{ color: 'var(--color-store-border)' }}
              fill="none"
              viewBox="0 0 80 80"
              aria-hidden="true"
            >
              <rect x="8" y="8" width="64" height="64" rx="8"
                stroke="currentColor" strokeWidth="3" />
              <circle cx="28" cy="28" r="8" stroke="currentColor" strokeWidth="3" />
              <path d="M8 60l20-20 16 16 12-12 16 16"
                stroke="currentColor" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Prev / Next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {/* Discount badge */}
        {discount && (
          <div className="absolute top-3 left-3 bg-accent text-accent-text text-xs font-bold px-2.5 py-1 rounded-full">
            -{discount}%
          </div>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
            <span
              className="bg-white text-sm font-semibold px-4 py-2 rounded-full shadow-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to image ${idx + 1}`}
              className="rounded-full transition-all duration-200"
              style={{
                width: idx === currentIndex ? 20 : 8,
                height: 8,
                backgroundColor:
                  idx === currentIndex
                    ? 'var(--color-accent)'
                    : 'var(--color-store-border)',
              }}
            />
          ))}
        </div>
      )}

      {/* Thumbnail strip */}
      {images.length >= 2 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              aria-label={`View image ${i + 1}`}
              className={cn(
                'relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors',
                i === currentIndex
                  ? 'border-accent'
                  : 'border-store-border hover:border-accent/50',
              )}
            >
              <Image
                src={url}
                alt={`${productName} thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}