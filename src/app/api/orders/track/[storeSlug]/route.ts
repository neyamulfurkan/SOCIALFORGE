import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/orders/track/[storeSlug]?phone=01XXXXXXXXX&orderNumber=SFXXXXXXXX
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> },
): Promise<NextResponse> {
  const { storeSlug } = await params;
  const url = req.nextUrl;

  const phone = url.searchParams.get('phone')?.trim();
  const orderNumber = url.searchParams.get('orderNumber')?.trim().replace('#', '');

  if (!phone && !orderNumber) {
    return NextResponse.json(
      { error: 'Provide a phone number or order number.' },
      { status: 400 },
    );
  }

  // Find business by slug
  const business = await prisma.business.findUnique({
    where: { slug: storeSlug },
    select: { id: true, status: true },
  });

  if (!business || business.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
  }

  // Build where clause
  const where: Record<string, unknown> = { businessId: business.id };

  if (orderNumber) {
    where.orderNumber = { contains: orderNumber, mode: 'insensitive' };
  } else if (phone) {
    where.customerPhone = phone;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (orders.length === 0) {
    return NextResponse.json({ error: 'No orders found.' }, { status: 404 });
  }

  // Serialize Decimal fields to numbers
  const serialized = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    subtotal: Number(order.subtotal),
    deliveryCharge: Number(order.deliveryCharge),
    total: Number(order.total),
    createdAt: order.createdAt.toISOString(),
    statusHistory: order.statusHistory,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      price: Number(item.price),
      imageUrl: item.imageUrl,
    })),
  }));

  return NextResponse.json({ data: serialized });
}