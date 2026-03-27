// src/app/(store)/[storeSlug]/page.tsx

import React from 'react';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import type { ProductWithVariants, StoreConfig } from '@/lib/types';
import { buildCloudinaryUrl, cn } from '@/lib/utils';
import { IMAGE_TRANSFORMS } from '@/lib/constants';
import HeroCarousel from '@/components/store/HeroCarousel';
import ProductGrid from '@/components/store/ProductGrid';

export const revalidate = 30;

export async function generateStaticParams(): Promise<Array<{ storeSlug: string }>> {
  const businesses = await prisma.business.findMany({ where: { status: 'ACTIVE' }, select: { slug: true } });
  return businesses.map((b) => ({ storeSlug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug: storeSlug },
    select: { name: true, tagline: true, logo: true },
  });
  return {
    title: business?.name ?? storeSlug,
    description: business?.tagline ?? undefined,
    openGraph: { images: business?.logo ? [business.logo] : [] },
  };
}

type StoreData = {
  business: {
    id: string; name: string; slug: string; logo: string | null; tagline: string | null;
    accentColor: string; heroImages: string[]; domain: string | null;
    config: {
      chatbotPersonality: string; chatbotWelcomeMessage: string; chatbotLanguage: string;
      knowledgeBase: unknown; deliveryCharge: unknown; freeDeliveryThreshold: unknown;
      deliveryTimeMessage: string | null; cashOnDelivery: boolean; bkashNumber: string | null;
      bkashInstructions: string | null; nagadNumber: string | null; nagadInstructions: string | null;
      stripePublicKey: string | null; stripeSecretKey: string | null; facebookPageId: string | null;
      facebookPageToken: string | null; instagramAccountId: string | null; messengerEnabled: boolean;
      socialAutoApprove: boolean; defaultPostTime: string; notificationEmail: string | null;
      notifyOnOrder: boolean; notifyOnMessage: boolean;
    } | null;
  };
  products: ProductWithVariants[];
  categories: string[];
};

function getStoreData(storeSlug: string): Promise<StoreData | null> {
  return unstable_cache(
    async (): Promise<StoreData | null> => {
      const business = await prisma.business.findUnique({
        where: { slug: storeSlug },
        include: { config: true },
      });
      if (!business || business.status !== 'ACTIVE') return null;
      const products = await prisma.product.findMany({
        where: { businessId: business.id, status: 'ACTIVE' },
        include: { variants: true },
        take: 12,
        orderBy: { createdAt: 'desc' },
      });
      const categories = [...new Set(products.map((p) => p.category))];
      const serializedProducts = products.map((p) => ({
    ...p,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    variants: p.variants.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    })),
  }));
  return { business, products: serializedProducts as unknown as ProductWithVariants[], categories };
    },
    ['store-home-' + storeSlug],
    { revalidate: 30, tags: ['store-' + storeSlug] },
  )();
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<React.JSX.Element> {
  const { storeSlug } = await params;
  const data = await getStoreData(storeSlug);
  if (!data) return notFound();
  const { business, products, categories } = data;

  const storeConfig: StoreConfig = {
    id: business.id,
    name: business.name,
    slug: business.slug,
    logo: business.logo ?? undefined,
    tagline: business.tagline ?? undefined,
    accentColor: business.accentColor,
    heroImages: business.heroImages ?? [],
    domain: business.domain ?? undefined,
    config: {
      chatbotPersonality: business.config?.chatbotPersonality ?? 'friendly',
      chatbotWelcomeMessage: business.config?.chatbotWelcomeMessage ?? '',
      chatbotLanguage: business.config?.chatbotLanguage ?? 'en',
      knowledgeBase: (business.config?.knowledgeBase as Array<{ question: string; answer: string }>) ?? [],
      deliveryCharge: Number(business.config?.deliveryCharge ?? 0),
      freeDeliveryThreshold: business.config?.freeDeliveryThreshold
        ? Number(business.config.freeDeliveryThreshold)
        : null,
      deliveryTimeMessage: business.config?.deliveryTimeMessage ?? null,
      cashOnDelivery: business.config?.cashOnDelivery ?? true,
      bkashNumber: business.config?.bkashNumber ?? null,
      bkashInstructions: business.config?.bkashInstructions ?? null,
      nagadNumber: business.config?.nagadNumber ?? null,
      nagadInstructions: business.config?.nagadInstructions ?? null,
      stripePublicKey: business.config?.stripePublicKey ?? null,
      stripeSecretKey: business.config?.stripeSecretKey ?? null,
      facebookPageId: business.config?.facebookPageId ?? null,
      facebookPageToken: business.config?.facebookPageToken ?? null,
      instagramAccountId: business.config?.instagramAccountId ?? null,
      messengerEnabled: business.config?.messengerEnabled ?? false,
      socialAutoApprove: business.config?.socialAutoApprove ?? false,
      defaultPostTime: business.config?.defaultPostTime ?? '10:00',
      notificationEmail: business.config?.notificationEmail ?? null,
      notifyOnOrder: business.config?.notifyOnOrder ?? true,
      notifyOnMessage: business.config?.notifyOnMessage ?? true,
    },
  };

 const heroImages = business.heroImages?.length
    ? business.heroImages
    : products[0]?.images?.[0]
    ? [products[0].images[0]]
    : [];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <HeroSection
        business={business}
        heroImages={heroImages}
        storeSlug={storeSlug}
        productCount={products.length}
      />

      {/* ── Category Pills ───────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="relative z-30" style={{ marginTop: '-68px' }}>
          <CategoryStrip categories={categories} storeSlug={storeSlug} />
        </div>
      )}

      {/* ── Products ─────────────────────────────────────────────── */}
      <section className="px-4 md:px-8 py-10 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent mb-1">Collection</p>
            <h2 className="text-2xl md:text-3xl font-bold text-store-text tracking-tight">
              {products.length === 0 ? 'Coming Soon' : 'All Products'}
            </h2>
          </div>
          {products.length > 0 && (
            <Link
              href={`/${storeSlug}/products`}
              className="text-[13px] font-semibold text-accent hover:underline underline-offset-2 flex items-center gap-1"
            >
              View all
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          )}
        </div>
        <ProductGrid products={products} storeSlug={storeSlug} />
      </section>

      {/* ── Trust strip ──────────────────────────────────────────── */}
      <TrustStrip />

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-store-border mt-4 py-8 px-6 text-center">
        <p className="text-xs text-store-text-tertiary">
          © {new Date().getFullYear()} {business.name}. Powered by{' '}
          <span className="font-semibold text-accent">SocialForge</span>
        </p>
      </footer>
    </>
  );
}



function HeroSection({
  business,
  heroImages,
  storeSlug,
  productCount,
}: {
  business: { name: string; tagline: string | null; logo: string | null };
  heroImages: string[];
  storeSlug: string;
  productCount: number;
}) {
  return (
    <section
      className="relative w-full overflow-hidden bg-[#0a0a09]"
      style={{ height: '100vh', minHeight: 560, maxHeight: '100vh' }}
    >
      {/* Carousel */}
      <HeroCarousel images={heroImages} businessName={business.name} />

      {/* Left overlay */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(100deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.15) 55%, transparent 100%)',
        }}
      />
      {/* Bottom dark fade */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
        style={{
          height: '220px',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      {/* Tall white curve — categories live inside this */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
        style={{ height: '110px', overflow: 'hidden' }}
      >
        <svg
          viewBox="0 0 1440 110"
          preserveAspectRatio="none"
          style={{ position: 'absolute', bottom: 0, width: '100%', height: '100%', display: 'block' }}
        >
          <path
            d="M0,110 L0,72 C200,28 480,12 720,20 C960,28 1200,58 1440,44 L1440,110 Z"
            fill="var(--color-store-bg, #fafaf9)"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-20 h-full flex items-center px-6 md:px-16 max-w-7xl mx-auto overflow-y-auto" style={{ paddingTop: '72px', paddingBottom: '100px' }}>
        <div style={{ maxWidth: '420px', width: '100%' }}>

          {/* Eyebrow — refined label */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="h-px w-8"
              style={{ background: 'var(--color-accent)' }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: 'var(--color-accent)' }}
            >
              {productCount > 0 ? `${productCount} Products` : 'Opening Soon'}
            </span>
          </div>

          {/* Store name — auto-fit single line */}
          <h1
            className="font-black text-white leading-[0.95] tracking-[-0.05em] mb-4"
            style={{
              fontSize: 'clamp(1.75rem, 3.8vw, 3.6rem)',
              textShadow: '0 2px 40px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 'min(520px, 80vw)',
            }}
          >
            {business.name}
          </h1>

          {/* Tagline */}
          {business.tagline ? (
            <p
              className="mb-8 leading-relaxed font-light"
              style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.5)',
                maxWidth: '320px',
                letterSpacing: '0.01em',
              }}
            >
              {business.tagline}
            </p>
          ) : (
            <div className="mb-8" />
          )}

          {/* CTA row */}
          <div className="flex items-center gap-3">
            <Link
              href={`/${storeSlug}/products`}
              className="group inline-flex items-center gap-2 font-bold text-[13px] text-white transition-all duration-200 hover:gap-3"
              style={{
                background: 'var(--color-accent)',
                padding: '11px 24px',
                borderRadius: '10px',
                letterSpacing: '0.02em',
                boxShadow: '0 4px 20px color-mix(in srgb, var(--color-accent) 40%, transparent)',
              }}
            >
              Shop Now
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5"
                fill="none" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>

            <Link
              href={`/${storeSlug}/track`}
              className="inline-flex items-center gap-2 font-semibold text-[13px] transition-all duration-200"
              style={{
                padding: '11px 20px',
                borderRadius: '10px',
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)',
                background: 'rgba(255,255,255,0.05)',
                letterSpacing: '0.02em',
              }}
            >
              Track Order
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Category Strip ───────────────────────────────────────────────────────────

function CategoryStrip({ categories, storeSlug }: { categories: string[]; storeSlug: string }) {
  return (
    <div
      className="w-full overflow-x-auto"
      style={{
        background: 'linear-gradient(to bottom, transparent 0%, var(--color-store-bg, #fafaf9) 60%)',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <div className="flex gap-2 px-4 md:px-8 min-w-max" style={{ paddingTop: '20px', paddingBottom: '16px' }}>
        {/* "All" pill */}
        <Link
          href={`/${storeSlug}/products`}
          style={{
            flexShrink: 0,
            padding: '7px 18px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            background: 'var(--color-accent)',
            color: 'white',
            letterSpacing: '0.02em',
            boxShadow: '0 2px 12px color-mix(in srgb, var(--color-accent) 35%, transparent)',
          }}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat}
            href={`/${storeSlug}/products?category=${encodeURIComponent(cat)}`}
            style={{
              flexShrink: 0,
              padding: '7px 18px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.92)',
              color: 'var(--color-store-text, #1c1c1a)',
              border: '1px solid rgba(0,0,0,0.08)',
              backdropFilter: 'blur(12px)',
              letterSpacing: '0.01em',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              transition: 'all 0.15s',
            }}
          >
            {cat}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Trust Strip ─────────────────────────────────────────────────────────────

function TrustStrip() {
  const items = [
    { icon: '🚚', label: 'Fast Delivery' },
    { icon: '✅', label: 'Verified Quality' },
    { icon: '🔒', label: 'Secure Checkout' },
    { icon: '💬', label: 'AI-Powered Support' },
  ];
  return (
    <div className="border-y border-store-border bg-store-surface py-5 px-4 md:px-8">
      <div className="max-w-4xl mx-auto flex items-center justify-around gap-4 flex-wrap">
        {items.map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-2.5">
            <span className="text-xl">{icon}</span>
            <span className="text-[13px] font-semibold text-store-text">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}