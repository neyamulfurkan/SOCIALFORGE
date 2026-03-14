import React from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import StoreShell from '@/components/store/StoreShell';
import type { StoreConfig } from '@/lib/types';

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