// src/app/(store)/[storeSlug]/products/[productSlug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { prisma } from '@/lib/db';
import { buildCloudinaryUrl, formatPrice, cn } from '@/lib/utils';
import { IMAGE_TRANSFORMS } from '@/lib/constants';
import StoreShell from '@/components/store/StoreShell';
import AddToCartSection from './AddToCartSection';
import ImageGallery from './ImageGallery';
import type { StoreConfig } from '@/lib/types';

export const revalidate = 30;

// ─────────────────────────────────────────────
// STATIC PARAMS
// ─────────────────────────────────────────────

export async function generateStaticParams(): Promise<Array<{ storeSlug: string; productSlug: string }>> {
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', business: { status: 'ACTIVE' } },
    select: { slug: true, business: { select: { slug: true } } },
    take: 1000,
  });
  return products.map((p) => ({
    storeSlug: p.business.slug,
    productSlug: p.slug,
  }));
}

// ─────────────────────────────────────────────
// METADATA
// ─────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug, productSlug } = await params;

  const business = await prisma.business.findUnique({
    where: { slug: storeSlug },
    select: { id: true, name: true },
  });
  if (!business) return {};

  const product = await prisma.product.findFirst({
    where: { businessId: business.id, slug: productSlug, status: 'ACTIVE' },
    select: { name: true, description: true, images: true, price: true },
  });
  if (!product) return {};

  const imageUrl = product.images[0]
    ? buildCloudinaryUrl(product.images[0], IMAGE_TRANSFORMS.PRODUCT, 1200)
    : undefined;

  return {
    title: `${product.name} — ${business.name}`,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default async function ProductPage({
  params,
}: {
  params: Promise<{ storeSlug: string; productSlug: string }>;
}): Promise<React.JSX.Element> {
  const { storeSlug, productSlug } = await params;

  // Fetch business + config
  const business = await prisma.business.findFirst({
    where: {
      OR: [{ slug: storeSlug }, { domain: storeSlug }],
      status: 'ACTIVE',
    },
    include: { config: true },
  });
  if (!business || !business.config) return notFound();

  // Fetch product
  const product = await prisma.product.findFirst({
    where: { businessId: business.id, slug: productSlug, status: 'ACTIVE' },
    include: { variants: true },
  });
  if (!product) return notFound();

  // Fetch related products (same category, exclude current)
  const related = await prisma.product.findMany({
    where: {
      businessId: business.id,
      status: 'ACTIVE',
      category: product.category,
      NOT: { id: product.id },
    },
    include: { variants: true },
    take: 4,
    orderBy: { createdAt: 'desc' },
  });

  // Build StoreConfig
  const storeConfig: StoreConfig = {
    id: business.id,
    name: business.name,
    slug: business.slug,
    logo: business.logo ?? undefined,
    tagline: business.tagline ?? undefined,
    accentColor: business.accentColor,
    domain: business.domain ?? undefined,
    config: {
      chatbotPersonality: business.config.chatbotPersonality,
      chatbotWelcomeMessage: business.config.chatbotWelcomeMessage,
      chatbotLanguage: business.config.chatbotLanguage,
      knowledgeBase: business.config.knowledgeBase as Array<{
        question: string;
        answer: string;
      }>,
      deliveryCharge: Number(business.config.deliveryCharge),
      freeDeliveryThreshold: business.config.freeDeliveryThreshold
        ? Number(business.config.freeDeliveryThreshold)
        : null,
      deliveryTimeMessage: business.config.deliveryTimeMessage ?? null,
      cashOnDelivery: business.config.cashOnDelivery,
      bkashNumber: business.config.bkashNumber ?? null,
      bkashInstructions: business.config.bkashInstructions ?? null,
      nagadNumber: business.config.nagadNumber ?? null,
      nagadInstructions: business.config.nagadInstructions ?? null,
      stripePublicKey: business.config.stripePublicKey ?? null,
      stripeSecretKey: business.config.stripeSecretKey ?? null,
      facebookPageId: business.config.facebookPageId ?? null,
      facebookPageToken: business.config.facebookPageToken ?? null,
      instagramAccountId: business.config.instagramAccountId ?? null,
      messengerEnabled: business.config.messengerEnabled,
      socialAutoApprove: business.config.socialAutoApprove,
      defaultPostTime: business.config.defaultPostTime,
      notificationEmail: business.config.notificationEmail ?? null,
      notifyOnOrder: business.config.notifyOnOrder,
      notifyOnMessage: business.config.notifyOnMessage,
    },
  };

  const price = Number(product.price);
  const compareAtPrice = product.compareAtPrice
    ? Number(product.compareAtPrice)
    : null;
  const discount =
    compareAtPrice && compareAtPrice > price
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
      : null;

  const outOfStock = product.trackStock && product.stockQuantity === 0;
  const lowStock =
    product.trackStock &&
    product.stockQuantity > 0 &&
    product.stockQuantity <= 5;

  // Build image URLs
  const imageUrls = product.images.map((img) =>
    buildCloudinaryUrl(img, IMAGE_TRANSFORMS.PRODUCT, 800),
  );

  return (
    <StoreShell storeConfig={storeConfig} storeSlug={storeSlug}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs mb-6" aria-label="Breadcrumb">
          <a
            href={`/${storeSlug}`}
            className="text-store-text opacity-50 hover:opacity-80 transition-opacity"
          >
            Home
          </a>
          <span className="text-store-text opacity-30">/</span>
          <a
            href={`/${storeSlug}/products?category=${encodeURIComponent(product.category)}`}
            className="text-store-text opacity-50 hover:opacity-80 transition-opacity"
          >
            {product.category}
          </a>
          <span className="text-store-text opacity-30">/</span>
          <span className="text-store-text opacity-80 truncate max-w-[180px]">
            {product.name}
          </span>
        </nav>

        {/* Main product section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14">

          {/* ── Image gallery ── */}
          <ImageGallery
            images={imageUrls}
            productName={product.name}
            discount={discount}
            outOfStock={outOfStock}
          />

          {/* ── Product info ── */}
          <div className="flex flex-col gap-5">

            {/* Category tag */}
            <a
              href={`/${storeSlug}/products?category=${encodeURIComponent(product.category)}`}
              className="self-start text-xs font-medium px-3 py-1 rounded-full border border-store-border text-store-text opacity-60 hover:opacity-100 transition-opacity"
            >
              {product.category}
            </a>

            {/* Name */}
            <h1
              className="text-2xl md:text-3xl font-bold leading-tight"
              style={{ color: 'var(--color-store-text)' }}
            >
              {product.name}
            </h1>

            {/* Price row */}
            <div className="flex items-baseline gap-3">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: 'var(--color-accent)' }}
              >
                {formatPrice(price)}
              </span>
              {compareAtPrice && compareAtPrice > price && (
                <span
                  className="text-base line-through tabular-nums"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {formatPrice(compareAtPrice)}
                </span>
              )}
              {discount && (
                <span className="text-sm font-semibold text-green-600">
                  Save {discount}%
                </span>
              )}
            </div>

            {/* Stock status */}
            {outOfStock ? (
              <p className="text-sm font-medium text-red-500">Out of stock</p>
            ) : lowStock ? (
              <p className="text-sm font-medium text-amber-500">
                Only {product.stockQuantity} left in stock
              </p>
            ) : null}

            {/* Description */}
            {product.description && (
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {product.description}
              </p>
            )}

            {/* Divider */}
            <div className="border-t border-store-border" />

            {/* Add to cart — client component handles variants + cart */}
            <AddToCartSection
              product={{
                id: product.id,
                name: product.name,
                price,
                slug: product.slug,
                images: product.images,
                trackStock: product.trackStock,
                stockQuantity: product.stockQuantity,
                variants: product.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  options: v.options as string[],
                })),
              }}
              storeSlug={storeSlug}
            />

            {/* Delivery info */}
            {(business.config.deliveryTimeMessage ||
              Number(business.config.deliveryCharge) === 0) && (
              <div className="flex flex-col gap-1.5 text-xs"
                style={{ color: 'var(--color-text-secondary)' }}>
                {Number(business.config.deliveryCharge) === 0 && (
                  <p className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M5 12l4 4L19 7" />
                    </svg>
                    Free delivery on all orders
                  </p>
                )}
                {business.config.freeDeliveryThreshold &&
                  Number(business.config.deliveryCharge) > 0 && (
                  <p className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M5 12l4 4L19 7" />
                    </svg>
                    Free delivery over {formatPrice(Number(business.config.freeDeliveryThreshold))}
                  </p>
                )}
                {business.config.deliveryTimeMessage && (
                  <p className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {business.config.deliveryTimeMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2
              className="text-lg font-bold mb-5"
              style={{ color: 'var(--color-store-text)' }}
            >
              You might also like
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((p) => {
                const relatedImage = p.images[0]
                  ? buildCloudinaryUrl(p.images[0], IMAGE_TRANSFORMS.PRODUCT, 400)
                  : null;
                return (
                  <a
                    key={p.id}
                    href={`/${storeSlug}/products/${p.slug}`}
                    className="group block bg-store-surface rounded-lg overflow-hidden border border-store-border hover:shadow-md transition-shadow"
                  >
                    <div
                      className="relative overflow-hidden bg-store-border"
                      style={{ aspectRatio: '3/4' }}
                    >
                      {relatedImage ? (
                        <Image
                          src={relatedImage}
                          alt={p.name}
                          fill
                          className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          sizes="(max-width: 768px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-10 h-10" style={{ color: 'var(--color-store-border)' }}
                            fill="none" viewBox="0 0 40 40" aria-hidden="true">
                            <rect x="4" y="4" width="32" height="32" rx="4"
                              stroke="currentColor" strokeWidth="2" />
                            <circle cx="14" cy="14" r="4" stroke="currentColor" strokeWidth="2" />
                            <path d="M4 28l8-8 6 6 6-6 8 8"
                              stroke="currentColor" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p
                        className="text-sm font-medium line-clamp-2 mb-1"
                        style={{ color: 'var(--color-store-text)' }}
                      >
                        {p.name}
                      </p>
                      <p
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        {formatPrice(Number(p.price))}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </StoreShell>
  );
}