// src/app/(dashboard)/dashboard/settings/page.tsx

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { BusinessConfigShape } from '@/lib/types';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect('/login');

  const business = await prisma.business.findUnique({
    where: { id: session.user.businessId },
    include: { config: true },
  });

  if (!business || !business.config) redirect('/dashboard');

  const config: BusinessConfigShape = {
    chatbotPersonality: business.config.chatbotPersonality,
    chatbotWelcomeMessage: business.config.chatbotWelcomeMessage,
    chatbotLanguage: business.config.chatbotLanguage,
    knowledgeBase: business.config.knowledgeBase as Array<{ question: string; answer: string }>,
    deliveryCharge: Number(business.config.deliveryCharge),
    freeDeliveryThreshold: business.config.freeDeliveryThreshold
      ? Number(business.config.freeDeliveryThreshold)
      : null,
    deliveryTimeMessage: business.config.deliveryTimeMessage,
    cashOnDelivery: business.config.cashOnDelivery,
    bkashNumber: business.config.bkashNumber,
    bkashInstructions: business.config.bkashInstructions,
    nagadNumber: business.config.nagadNumber,
    nagadInstructions: business.config.nagadInstructions,
    stripePublicKey: business.config.stripePublicKey,
    stripeSecretKey: business.config.stripeSecretKey,
    facebookPageId: business.config.facebookPageId,
    facebookPageToken: business.config.facebookPageToken,
    instagramAccountId: business.config.instagramAccountId,
    messengerEnabled: business.config.messengerEnabled,
    socialAutoApprove: business.config.socialAutoApprove,
    defaultPostTime: business.config.defaultPostTime,
    notificationEmail: business.config.notificationEmail,
    notifyOnOrder: business.config.notifyOnOrder,
    notifyOnMessage: business.config.notifyOnMessage,
  };

  const brandingData = {
    name: business.name,
    slug: business.slug,
    logo: business.logo ?? null,
    tagline: business.tagline ?? null,
    accentColor: business.accentColor,
    heroImages: business.heroImages ?? [],
    domain: business.domain ?? null,
  };

  return (
    <SettingsClient
      config={config}
      brandingData={brandingData}
      businessId={business.id}
      isSuperAdmin={session.user.role === 'SUPER_ADMIN'}
    />
  );
}