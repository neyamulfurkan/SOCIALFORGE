'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  images: string[];
  businessName: string;
};

// ─── Empty state — no images uploaded yet ────────────────────────────────────

function EmptyHero({ businessName }: { businessName: string }) {
  return (
    <div className="absolute inset-0" style={{ background: '#080808' }}>
      {/* Diagonal grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.8) 0px, rgba(255,255,255,0.8) 1px, transparent 1px, transparent 60px)',
        }}
      />
      {/* Accent glow bottom-left */}
      <div
        className="absolute"
        style={{
          width: '50vw',
          height: '50vw',
          bottom: '-10vw',
          left: '-10vw',
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 20%, transparent) 0%, transparent 65%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center px-8"
        >
          <div
            className="inline-block mb-8 px-4 py-1.5 text-[9px] tracking-[0.45em] uppercase font-semibold"
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.45em',
            }}
          >
            Welcome
          </div>
          <h1
            className="text-white font-black"
            style={{
              fontSize: 'clamp(3rem, 9vw, 8rem)',
              letterSpacing: '-0.05em',
              lineHeight: 0.9,
            }}
          >
            {businessName}
          </h1>
          <motion.div
            className="mx-auto mt-8"
            style={{ width: 1, height: 48, background: 'rgba(255,255,255,0.15)' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          />
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main Carousel ────────────────────────────────────────────────────────────

export default function HeroCarousel({ images, businessName }: Props) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = images.length;

  const go = useCallback(
    (nextIndex: number) => {
      if (isTransitioning || nextIndex === current) return;
      setIsTransitioning(true);
      setPrev(current);
      setCurrent((nextIndex + total) % total);
      setTimeout(() => {
        setPrev(null);
        setIsTransitioning(false);
      }, 900);
    },
    [current, isTransitioning, total],
  );

  const goNext = useCallback(() => go((current + 1) % total), [current, go, total]);
  const goPrev = useCallback(() => go((current - 1 + total) % total), [current, go, total]);

  // Auto-advance
  useEffect(() => {
    if (total <= 1 || paused) return;
    timerRef.current = setTimeout(goNext, 6000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused, goNext, total]);

  // Keyboard
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [goNext, goPrev]);

  if (total === 0) return <EmptyHero businessName={businessName} />;

  return (
    <div
      className="absolute inset-0"
      style={{ overflow: 'hidden', background: '#080808' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onMouseDown={(e) => setDragStart(e.clientX)}
      onMouseUp={(e) => {
        if (dragStart === null) return;
        const d = e.clientX - dragStart;
        if (Math.abs(d) > 50) d < 0 ? goNext() : goPrev();
        setDragStart(null);
      }}
      onTouchStart={(e) => setDragStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (dragStart === null) return;
        const d = e.changedTouches[0].clientX - dragStart;
        if (Math.abs(d) > 40) d < 0 ? goNext() : goPrev();
        setDragStart(null);
      }}
    >

      {/* ── Previous slide fading out ─────────────────────────────────────── */}
      {prev !== null && (
        <div
          key={`prev-${prev}`}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            transition: 'opacity 900ms cubic-bezier(0.4,0,0.2,1)',
            opacity: 0,
          }}
        >
          <img
            src={images[prev]}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          />
        </div>
      )}

      {/* ── Current slide ─────────────────────────────────────────────────── */}
      <motion.div
        key={`slide-${current}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
        style={{ position: 'absolute', inset: 0, zIndex: 2 }}
      >
        <motion.img
          src={images[current]}
          alt={`${businessName} ${current + 1}`}
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />

        {/* ── Overlays ───────────────────────────────────────────────────── */}

        {/* Dark base — lighter */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)' }} />

        {/* Left vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(100deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.05) 60%, transparent 100%)',
          }}
        />

        {/* Bottom fade */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '45%',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)',
          }}
        />

        {/* Top fade for nav */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '20%',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)',
          }}
        />
      </motion.div>

      {/* ── Vertical rule — design detail ─────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(50% - 1px)',
          top: 0,
          bottom: 0,
          width: 1,
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />

      {/* ── Navigation arrows ─────────────────────────────────────────────── */}
      {total > 1 && (
        <>
          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous"
            style={{
              position: 'absolute',
              left: 24,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.3)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next"
            style={{
              position: 'absolute',
              right: 24,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.3)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      {/* ── Slide counter — top right ──────────────────────────────────────── */}
      {total > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 88,
            right: 28,
            zIndex: 10,
            display: 'flex',
            alignItems: 'baseline',
            gap: 3,
            userSelect: 'none',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={current}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 6, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}
            >
              {String(current + 1).padStart(2, '0')}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>/</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>
            {String(total).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* ── Progress bar — bottom ──────────────────────────────────────────── */}
      {total > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: 'flex',
            gap: 3,
            padding: '0 28px 20px',
          }}
        >
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); go(i); }}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                flex: 1,
                height: 2,
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 2,
              }}
            >
              {i === current && (
                <motion.div
                  key={`p-${current}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'white',
                    transformOrigin: 'left',
                  }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 6, ease: 'linear' }}
                />
              )}
              {i < current && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}