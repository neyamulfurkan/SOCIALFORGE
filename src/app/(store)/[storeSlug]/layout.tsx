import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import StoreShell from '@/components/store/StoreShell';
import type { StoreConfig } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const business = await prisma.business.findFirst({
    where: { OR: [{ slug: storeSlug }, { domain: storeSlug }], status: 'ACTIVE' },
    select: { name: true, tagline: true, logo: true, slug: true, domain: true },
  });
  if (!business) return {};
  const siteUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const storeUrl = business.domain
    ? `https://${business.domain}`
    : `${siteUrl}/${business.slug}`;
  return {
    metadataBase: new URL(siteUrl),
    robots: { index: true, follow: true },
    alternates: {
      canonical: storeUrl,
    },
    openGraph: {
      type: 'website',
      url: storeUrl,
      siteName: business.name,
      images: business.logo ? [{ url: business.logo, alt: business.name }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      images: business.logo ? [business.logo] : [],
    },
  };
}

export async function generateStaticParams(): Promise<Array<{ storeSlug: string }>> {
  const businesses = await prisma.business.findMany({
    where: { status: 'ACTIVE' },
    select: { slug: true },
  });
  return businesses.map((b) => ({ storeSlug: b.slug }));
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}): Promise<React.JSX.Element> {
  const { storeSlug } = await params;

  const business = await prisma.business.findFirst({
    where: {
      OR: [{ slug: storeSlug }, { domain: storeSlug }],
      status: 'ACTIVE',
    },
    include: { config: true },
  });

  if (!business) return notFound();

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
      knowledgeBase: (business.config?.knowledgeBase as Array<{
        question: string;
        answer: string;
      }>) ?? [],
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

  return (
    <div
      style={{
        '--color-accent': storeConfig.accentColor,
      } as React.CSSProperties}
      data-store-wrapper="true"
    >
      <StoreShell storeConfig={storeConfig} storeSlug={storeSlug}>
        {children}
      </StoreShell>
    </div>
  );
}