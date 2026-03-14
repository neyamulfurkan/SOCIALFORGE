import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import CheckoutForm from '@/components/store/CheckoutForm';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<React.JSX.Element> {
  const { storeSlug } = await params;

  const business = await prisma.business.findUnique({
    where: { slug: storeSlug },
    include: { config: true },
  });

  if (!business || business.status !== 'ACTIVE') return notFound();
  if (!business.config) return notFound();

  const paymentConfig = {
    cashOnDelivery: business.config.cashOnDelivery,
    bkashNumber: business.config.bkashNumber,
    bkashInstructions: business.config.bkashInstructions,
    nagadNumber: business.config.nagadNumber,
    nagadInstructions: business.config.nagadInstructions,
    stripePublicKey: business.config.stripePublicKey,
    deliveryCharge: Number(business.config.deliveryCharge),
    freeDeliveryThreshold: business.config.freeDeliveryThreshold
      ? Number(business.config.freeDeliveryThreshold)
      : null,
  };

  return (
    <div className="min-h-screen bg-[var(--color-store-bg)]">
      <CheckoutForm
        businessId={business.id}
        storeSlug={storeSlug}
        paymentConfig={paymentConfig}
      />
    </div>
  );
}