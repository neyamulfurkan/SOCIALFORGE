'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import type { StoreConfig } from '@/lib/types';

const Chatbot = dynamic(() => import('@/components/store/Chatbot'), { ssr: false });
const SearchOverlay = dynamic(() => import('@/components/store/SearchOverlay'), { ssr: false });

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function ShopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
function TrackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16v-2" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type StoreShellProps = {
  storeConfig: StoreConfig & { name: string; slug: string; logo?: string; accentColor: string };
  storeSlug: string;
  children: React.ReactNode;
};

// ─── Cart Badge ───────────────────────────────────────────────────────────────

function CartBadge({ count }: { count: string }) {
  if (count === '0') return null;
  return (
    <motion.span
      key={count}
      initial={{ scale: 0, rotate: -15 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 600, damping: 20 }}
      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[9px] font-black leading-none text-white"
      style={{ background: 'var(--color-accent)' }}
    >
      {count}
    </motion.span>
  );
}

// ─── Magnetic Button ──────────────────────────────────────────────────────────

function MagneticBtn({ children, className, onClick, ariaLabel }: {
  children: React.ReactNode; className?: string; onClick?: () => void; ariaLabel?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: (e.clientX - (rect.left + rect.width / 2)) * 0.28,
      y: (e.clientY - (rect.top + rect.height / 2)) * 0.28,
    });
  }

  return (
    <motion.button
      ref={ref}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 250, damping: 18 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </motion.button>
  );
}

// ─── Scroll Progress Bar ──────────────────────────────────────────────────────

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[50] h-[2px] origin-left pointer-events-none"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-hover, var(--color-accent)), var(--color-accent))',
        opacity: 0.85,
      }}
    />
  );
}

// ─── Top Navigation ───────────────────────────────────────────────────────────

function TopNav({
  storeConfig, storeSlug, itemCount, displayCount, onSearchOpen, scrolled,
}: {
  storeConfig: StoreShellProps['storeConfig']; storeSlug: string; itemCount: number;
  displayCount: string; onSearchOpen: () => void; scrolled: boolean;
}) {
  const [logoError, setLogoError] = useState(false);
  const pathname = usePathname();
  const isHeroPage = pathname === `/${storeSlug}`;
  const transparent = isHeroPage && !scrolled;

  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'hidden md:flex fixed top-0 left-0 right-0 z-40 items-center justify-between px-8 h-[72px]',
        'transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
        transparent
          ? 'bg-black/50 backdrop-blur-xl border-b border-white/[0.12]'
          : 'bg-white/[0.88] backdrop-blur-2xl border-b border-black/[0.05] shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_32px_rgba(0,0,0,0.05)]',
      )}
    >
      {/* ── Logo ── */}
      <Link href={`/${storeSlug}`} className="flex items-center gap-3 shrink-0 group" aria-label={storeConfig.name}>
        {storeConfig.logo && !logoError ? (
          <Image
            src={storeConfig.logo}
            alt={storeConfig.name}
            width={130}
            height={44}
            className="h-9 w-auto object-contain transition-opacity duration-200 group-hover:opacity-75"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="flex items-center gap-2.5">
            {/* Animated logo mark */}
            <div className="relative w-8 h-8 shrink-0">
              <motion.div
                className="absolute inset-0 rounded-[10px]"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover, var(--color-accent)))' }}
                animate={{ rotate: [0, 6, -6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-[10px]"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover, var(--color-accent)))', opacity: 0.5 }}
                animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
              />
              <SparkleIcon className="absolute inset-0 m-auto w-4 h-4 text-white z-10" />
            </div>
            <span className={cn(
              'text-[17px] font-black tracking-[-0.04em] transition-all duration-300',
              transparent ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]' : 'text-store-text',
            )}>
              {storeConfig.name}
            </span>
          </div>
        )}
      </Link>

      {/* ── Nav links ── */}
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        {[
          { label: 'Home', href: `/${storeSlug}` },
          { label: 'Shop', href: `/${storeSlug}/products` },
          { label: 'Track Order', href: `/${storeSlug}/track` },
        ].map(({ label, href }) => {
          const active = pathname === href || (href.includes('/products') && pathname.startsWith(`/${storeSlug}/products`));
          return (
            <Link key={href} href={href} className="relative group px-4 py-2">
              {/* Hover bg */}
              <motion.div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: transparent ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }}
              />
              <span className={cn(
                'relative z-10 text-[13px] font-semibold tracking-[0.01em] transition-colors duration-300',
                active
                  ? 'text-accent'
                  : transparent
                  ? 'text-white/85 group-hover:text-white'
                  : 'text-store-text-secondary group-hover:text-store-text',
              )}>
                {label}
              </span>
              {/* Active dot */}
              {active && (
                <motion.div
                  layoutId="nav-pip"
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Actions ── */}
      <div className="flex items-center gap-1.5">
        {/* Inline Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim();
            if (q) window.location.href = `/${storeSlug}/search?q=${encodeURIComponent(q)}`;
          }}
          className={cn(
            'hidden lg:flex items-center gap-2 h-9 px-3 rounded-xl border transition-all duration-300 w-48 focus-within:w-64',
            transparent
              ? 'bg-white/10 border-white/20 text-white focus-within:bg-white/15'
              : 'bg-black/[0.04] border-black/[0.08] text-store-text focus-within:bg-white focus-within:border-accent/40',
          )}
          style={transparent ? {} : {
            '--tw-shadow-focused': '0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent)',
          } as React.CSSProperties}
        >
          <SearchIcon className={cn('w-4 h-4 shrink-0 transition-colors duration-200', transparent ? 'text-white/60' : 'text-store-text-tertiary')} />
          <input
            name="q"
            type="search"
            placeholder="Search products…"
            className={cn(
              'bg-transparent outline-none text-[13px] w-full',
              transparent ? 'placeholder:text-white/50 text-white' : 'placeholder:text-store-text-tertiary text-store-text',
            )}
          />
        </form>

        {/* Cart */}
        <Link
          href={`/${storeSlug}/cart`}
          className={cn(
            'relative p-2.5 rounded-xl transition-all duration-200 group',
            transparent
              ? 'text-white/90 hover:bg-white/10 hover:text-white'
              : 'text-store-text-secondary hover:bg-black/[0.06] hover:text-store-text',
          )}
          aria-label={`Cart, ${itemCount} items`}
        >
          <CartIcon className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-[1.12]" />
          <CartBadge count={displayCount} />
        </Link>
      </div>
    </motion.header>
  );
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────

function BottomNav({ storeSlug, itemCount, displayCount, onSearchOpen }: {
  storeSlug: string; itemCount: number; displayCount: string;
  onSearchOpen: () => void;
}) {
  const pathname = usePathname();
  function isActive(href: string) {
    return href === `/${storeSlug}` ? pathname === href : pathname.startsWith(href);
  }

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="mx-4 mb-3 flex items-stretch h-[64px] rounded-[22px] overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {/* Home + Shop */}
        {[
          { id: 'home', label: 'Home', href: `/${storeSlug}`, Icon: HomeIcon },
          { id: 'shop', label: 'Shop', href: `/${storeSlug}/products`, Icon: ShopIcon },
        ].map(({ id, label, href, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={id}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative"
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.div
                  layoutId="bottom-active-pill"
                  className="absolute inset-x-2 inset-y-2 rounded-2xl"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <Icon className={cn(
                'w-[19px] h-[19px] relative z-10 transition-all duration-200',
                active ? 'text-accent scale-110' : 'text-store-text-tertiary',
              )} />
              <span className={cn(
                'text-[9px] font-black tracking-[0.1em] uppercase relative z-10 transition-colors duration-200',
                active ? 'text-accent' : 'text-store-text-tertiary',
              )}>
                {label}
              </span>
            </Link>
          );
        })}

        {/* Search */}
        <button
          onClick={onSearchOpen}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-store-text-tertiary hover:text-store-text-secondary transition-colors duration-200"
        >
          <SearchIcon className="w-[19px] h-[19px]" />
          <span className="text-[9px] font-black tracking-[0.1em] uppercase">Search</span>
        </button>

        {/* Track */}
        <Link
          href={`/${storeSlug}/track`}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 relative',
            isActive(`/${storeSlug}/track`) ? 'text-accent' : 'text-store-text-tertiary',
          )}
        >
          {isActive(`/${storeSlug}/track`) && (
            <motion.div
              layoutId="bottom-active-pill"
              className="absolute inset-x-2 inset-y-2 rounded-2xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <TrackIcon className={cn(
            'w-[19px] h-[19px] relative z-10 transition-all duration-200',
            isActive(`/${storeSlug}/track`) ? 'scale-110' : '',
          )} />
          <span className={cn(
            'text-[9px] font-black tracking-[0.1em] uppercase relative z-10 transition-colors duration-200',
            isActive(`/${storeSlug}/track`) ? 'text-accent' : 'text-store-text-tertiary',
          )}>Track</span>
        </Link>

        {/* Cart */}
        <Link
          href={`/${storeSlug}/cart`}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 relative',
            isActive(`/${storeSlug}/cart`) ? 'text-accent' : 'text-store-text-tertiary',
          )}
        >
          {isActive(`/${storeSlug}/cart`) && (
            <motion.div
              layoutId="bottom-active-pill"
              className="absolute inset-x-2 inset-y-2 rounded-2xl"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
          <span className="relative z-10">
            <CartIcon className={cn(
              'w-[19px] h-[19px] transition-all duration-200',
              isActive(`/${storeSlug}/cart`) ? 'scale-110' : '',
            )} />
            <CartBadge count={displayCount} />
          </span>
          <span className="text-[9px] font-black tracking-[0.1em] uppercase relative z-10">Cart</span>
        </Link>
      </div>
    </motion.nav>
  );
}

// ─── Floating AI FAB ──────────────────────────────────────────────────────────

function AIFab({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0, rotate: -90 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ scale: 0, opacity: 0, rotate: 90 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label="Open AI chat"
      className="fixed z-40 right-5 bottom-24 md:bottom-8 w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover, var(--color-accent)) 100%)',
        boxShadow: '0 0 0 1px color-mix(in srgb, var(--color-accent) 25%, transparent), 0 8px 30px color-mix(in srgb, var(--color-accent) 45%, transparent)',
      }}
    >
      {/* Conic shimmer ring */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ background: 'conic-gradient(from 0deg, transparent 60%, rgba(255,255,255,0.45) 80%, transparent 100%)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
      />
      {/* Pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ border: '1.5px solid rgba(255,255,255,0.35)' }}
        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
      />
      <SparkleIcon className="w-6 h-6 text-white relative z-10" />
    </motion.button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function StoreShell({ storeConfig, storeSlug, children }: StoreShellProps) {
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const displayCount = itemCount > 9 ? '9+' : String(itemCount);
  const chatbotOpen = useUIStore((s) => s.chatbotOpen);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const setChatbotOpen = useUIStore((s) => s.setChatbotOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 60); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <ScrollProgress />

      <div className="store-page min-h-screen bg-store-bg">
        <TopNav
          storeConfig={storeConfig}
          storeSlug={storeSlug}
          itemCount={itemCount}
          displayCount={displayCount}
          onSearchOpen={() => setSearchOpen(true)}
          scrolled={scrolled}
        />
        <main className="pt-[72px] pb-28 md:pb-0 md:pt-[72px]">{children}</main>
        <BottomNav
          storeSlug={storeSlug}
          itemCount={itemCount}
          displayCount={displayCount}
          onSearchOpen={() => setSearchOpen(true)}
        />
        <AnimatePresence>
          {!chatbotOpen && <AIFab onClick={() => setChatbotOpen(true)} />}
        </AnimatePresence>
      </div>

      {/* Portalled overlays — outside stacking context */}
      {searchOpen && (
        <SearchOverlay open={searchOpen} storeSlug={storeSlug} initialResults={[]} initialQuery="" />
      )}
      <AnimatePresence>
        {chatbotOpen && <Chatbot storeConfig={storeConfig} />}
      </AnimatePresence>
    </>
  );
}