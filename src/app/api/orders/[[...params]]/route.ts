import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/redis';
import { RATE_LIMITS, FULFILLMENT_STATUS_FLOW, STATUS_LABELS } from '@/lib/constants';
import { generateOrderNumber, getNextFulfillmentStatus } from '@/lib/utils';
import { auth } from '@/lib/auth';
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from '@/lib/resend';
import type { FulfillmentStatus } from '@prisma/client';

// ─────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────

const createOrderSchema = z
  .object({
    businessId: z.string(),
    customerName: z.string().min(1),
    customerPhone: z.string().min(7),
    customerEmail: z.string().email().optional(),
    deliveryAddress: z.string().min(1),
    items: z
      .array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().positive(),
          variantLabel: z.string().optional(),
        }),
      )
      .min(1),
    paymentMethod: z.enum(['BKASH', 'NAGAD', 'STRIPE', 'COD']),
    transactionId: z.string().optional(),
    channel: z.enum(['WEBSITE', 'MESSENGER', 'MANUAL']).default('WEBSITE'),
    messengerSenderId: z.string().optional(),
  })
  .refine((d) => d.channel !== 'MESSENGER' || !!d.messengerSenderId, {
    message: 'messengerSenderId required for Messenger orders',
    path: ['messengerSenderId'],
  });

const updateStatusSchema = z.object({
  status: z.enum(['NEW', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  note: z.string().optional(),
});

const updateNotesSchema = z.object({
  internalNotes: z.string(),
});

const analyticsQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  range: z.enum(['7d', '30d', '90d']).optional(),
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getDateRange(
  range?: string,
  dateFrom?: string,
  dateTo?: string,
): { from: Date; to: Date } {
  const to = dateTo ? new Date(dateTo) : new Date();
  if (dateFrom) {
    return { from: new Date(dateFrom), to };
  }
  const from = new Date(to);
  if (range === '90d') from.setDate(from.getDate() - 90);
  else if (range === '30d') from.setDate(from.getDate() - 30);
  else from.setDate(from.getDate() - 7);
  return { from, to };
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

async function getBusinessConfig(businessId: string) {
  return prisma.businessConfig.findUnique({ where: { businessId } });
}

async function getStoreConfigForEmail(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { config: true },
  });
  if (!business || !business.config) return null;
  const cfg = business.config;
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    logo: business.logo ?? undefined,
    tagline: business.tagline ?? undefined,
    accentColor: business.accentColor,
    
    domain: business.domain ?? undefined,
    config: {
      chatbotPersonality: cfg.chatbotPersonality,
      chatbotWelcomeMessage: cfg.chatbotWelcomeMessage,
      chatbotLanguage: cfg.chatbotLanguage,
      knowledgeBase: cfg.knowledgeBase as Array<{ question: string; answer: string }>,
      deliveryCharge: Number(cfg.deliveryCharge),
      freeDeliveryThreshold: cfg.freeDeliveryThreshold ? Number(cfg.freeDeliveryThreshold) : null,
      deliveryTimeMessage: cfg.deliveryTimeMessage,
      cashOnDelivery: cfg.cashOnDelivery,
      bkashNumber: cfg.bkashNumber,
      bkashInstructions: cfg.bkashInstructions,
      nagadNumber: cfg.nagadNumber,
      nagadInstructions: cfg.nagadInstructions,
      stripePublicKey: cfg.stripePublicKey ?? null,
      stripeSecretKey: cfg.stripeSecretKey ?? null,
      facebookPageId: cfg.facebookPageId ?? null,
      facebookPageToken: cfg.facebookPageToken ?? null,
      instagramAccountId: cfg.instagramAccountId ?? null,
      messengerEnabled: cfg.messengerEnabled,
      socialAutoApprove: cfg.socialAutoApprove,
      defaultPostTime: cfg.defaultPostTime,
      notificationEmail: cfg.notificationEmail ?? null,
      notifyOnOrder: cfg.notifyOnOrder,
      notifyOnMessage: cfg.notifyOnMessage,
    },
  };
}

async function sendMessengerStatusNotification(
  senderId: string,
  businessId: string,
  orderNumber: string,
  newStatus: string,
  order: {
    total: number;
    deliveryAddress: string;
    paymentMethod: string;
    items: Array<{ productName: string; quantity: number; price: number }>;
  },
): Promise<void> {
  try {
    const config = await getBusinessConfig(businessId);
    if (!config?.facebookPageToken) return;

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { slug: true, name: true },
    });

    const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;
    const trackingUrl = `${process.env.NEXTAUTH_URL ?? 'https://socialforge3.vercel.app'}/${business?.slug ?? ''}/track?order=${orderNumber}`;

    const statusMessages: Record<string, string> = {
      CONFIRMED: `✅ Order Confirmed!\n\nYour order #${orderNumber} has been confirmed and is being prepared.`,
      PROCESSING: `🔄 Order Processing!\n\nYour order #${orderNumber} is now being processed and packed.`,
      SHIPPED: `🚚 Order Shipped!\n\nGreat news! Your order #${orderNumber} is on its way to you.`,
      DELIVERED: `🎉 Order Delivered!\n\nYour order #${orderNumber} has been delivered. Thank you for shopping with us!`,
      CANCELLED: `❌ Order Cancelled\n\nYour order #${orderNumber} has been cancelled. Please contact us if you have any questions.`,
    };

    const itemLines = order.items
      .map((i) => `• ${i.productName} x${i.quantity} — ৳${Number(i.price * i.quantity).toLocaleString()}`)
      .join('\n');

    const baseMessage = statusMessages[newStatus] ?? `📦 Order Update\n\nYour order #${orderNumber} status: ${statusLabel}`;

    const fullMessage =
      `${baseMessage}\n\n` +
      `📋 Order Summary:\n${itemLines}\n\n` +
      `💰 Total: ৳${Number(order.total).toLocaleString()}\n` +
      `📍 Delivery to: ${order.deliveryAddress}\n` +
      `💳 Payment: ${order.paymentMethod}\n\n` +
      `🔍 Track your order: ${trackingUrl}`;

    await fetch('https://graph.facebook.com/v19.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: { text: fullMessage },
        access_token: config.facebookPageToken,
      }),
    });
  } catch (err) {
    console.error('Messenger status notification failed:', err);
  }
}

// ─────────────────────────────────────────────
// GET HANDLER
// ─────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const { params: segments } = await params;
  const seg = segments ?? [];
  const url = req.nextUrl;

  // ── Analytics ──────────────────────────────
  if (seg[0] === 'analytics') {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: 'No business found' }, { status: 403 });
    }

    const query = analyticsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    const { from, to } = getDateRange(
      query.success ? query.data.range : '30d',
      query.success ? query.data.dateFrom : undefined,
      query.success ? query.data.dateTo : undefined,
    );

    const [orders, topProductsRaw] = await Promise.all([
      prisma.order.findMany({
        where: {
          businessId,
          createdAt: { gte: from, lte: to },
          fulfillmentStatus: { not: 'CANCELLED' },
        },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: {
          order: {
            businessId,
            createdAt: { gte: from, lte: to },
            fulfillmentStatus: { not: 'CANCELLED' },
          },
        },
        _sum: { price: true, quantity: true },
        orderBy: { _sum: { price: 'desc' } },
        take: 5,
      }),
    ]);

    // Revenue by day
    const revenueByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};
    for (const order of orders) {
      const day = order.createdAt.toISOString().split('T')[0];
      revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(order.total);
      ordersByDay[day] = (ordersByDay[day] ?? 0) + 1;
    }

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const uniqueCustomers = new Set(orders.map((o) => o.customerPhone)).size;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = 0; // V1: no visitor tracking

    const topProducts = topProductsRaw.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      revenue: Number(p._sum.price ?? 0),
      quantity: p._sum.quantity ?? 0,
    }));

    return NextResponse.json({
      data: {
        revenueOverTime: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
        ordersOverTime: Object.entries(ordersByDay).map(([date, orders]) => ({ date, orders })),
        topProducts: topProducts.map((p, _, arr) => ({
          id: p.productId,
          name: p.productName,
          imageUrl: null,
          revenue: p.revenue,
          maxRevenue: Math.max(...arr.map((x) => x.revenue), 1),
        })),
        trafficSources: [],
        keyMetrics: {
          totalRevenue,
          averageOrderValue: avgOrderValue,
          conversionRate,
          totalCustomers: uniqueCustomers,
        },
      },
    });
  }

  // ── Dashboard Stats ────────────────────────
  if (seg[0] === 'stats') {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: 'No business found' }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    const [
      todayOrders,
      yesterdayOrders,
      revenueThisMonthAgg,
      revenueLastMonthAgg,
      activeConversations,
      pendingPosts,
    ] = await Promise.all([
      prisma.order.count({
        where: { businessId, createdAt: { gte: todayStart } },
      }),
      prisma.order.count({
        where: { businessId, createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
      }),
      prisma.order.aggregate({
        where: {
          businessId,
          createdAt: { gte: monthStart },
          fulfillmentStatus: { not: 'CANCELLED' },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          businessId,
          createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
          fulfillmentStatus: { not: 'CANCELLED' },
        },
        _sum: { total: true },
      }),
      prisma.messengerConversation.count({
        where: { businessId, status: 'OPEN' },
      }),
      prisma.socialPost.count({
        where: { businessId, status: 'PENDING_REVIEW' },
      }),
    ]);

    const revenueThisMonth = Number(revenueThisMonthAgg._sum.total ?? 0);
    const revenueLastMonth = Number(revenueLastMonthAgg._sum.total ?? 0);
    const ordersDelta =
      yesterdayOrders === 0
        ? todayOrders > 0
          ? 100
          : 0
        : Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100);
    const revenueDelta =
      revenueLastMonth === 0
        ? revenueThisMonth > 0
          ? 100
          : 0
        : Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100);

    return NextResponse.json({
      data: {
        todayOrders,
        revenueThisMonth,
        activeConversations,
        pendingPosts,
        ordersDelta,
        revenueDelta,
      },
    });
  }

  // ── Activity Feed ──────────────────────────
  if (seg[0] === 'activity') {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: 'No business found' }, { status: 403 });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activities = await prisma.activityLog.findMany({
      where: { businessId, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      data: activities.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        timestamp: a.createdAt,
        actionUrl: a.actionUrl ?? undefined,
        actionLabel: a.actionLabel ?? undefined,
        metadata: a.metadata as Record<string, unknown> | undefined,
      })),
    });
  }

  // ── Single order ───────────────────────────
  if (seg[0] && seg[0] !== 'analytics' && seg[0] !== 'stats' && seg[0] !== 'activity') {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: 'No business found' }, { status: 403 });
    }

    const order = await prisma.order.findFirst({
      where: { id: seg[0], businessId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ data: order });
  }

  // ── Order list ─────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const businessId = session.user.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'No business found' }, { status: 403 });
  }

  const status = url.searchParams.get('status') ?? undefined;
  const paymentStatus = url.searchParams.get('paymentStatus') ?? undefined;
  const channel = url.searchParams.get('channel') ?? undefined;
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const search = url.searchParams.get('search') ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10)));

  const where = {
    businessId,
    ...(status ? { fulfillmentStatus: status as FulfillmentStatus } : {}),
    ...(paymentStatus ? { paymentStatus: paymentStatus as never } : {}),
    ...(channel ? { channel: channel as never } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { customerName: { contains: search, mode: 'insensitive' as const } },
            { orderNumber: { contains: search, mode: 'insensitive' as const } },
            { customerPhone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    data: orders,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  });
}

// ─────────────────────────────────────────────
// POST HANDLER — PUBLIC (no auth)
// ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  await params; // satisfy Next.js async params requirement

  const ip = getClientIp(req);
  const rl = await rateLimit(`rl:orders:${ip}`, RATE_LIMITS.ORDERS.limit, RATE_LIMITS.ORDERS.window);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Verify business exists and is active
  const business = await prisma.business.findFirst({
    where: { id: data.businessId, status: 'ACTIVE' },
  });
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  // Fetch products and verify ownership
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, businessId: data.businessId, status: 'ACTIVE' },
  });

  if (products.length !== productIds.length) {
    return NextResponse.json(
      { error: 'One or more products not found or unavailable', code: 'PRODUCT_NOT_FOUND' },
      { status: 400 },
    );
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Fetch business config for delivery charge
  const config = await getBusinessConfig(data.businessId);
  const deliveryCharge = config ? Number(config.deliveryCharge) : 0;
  const freeDeliveryThreshold = config?.freeDeliveryThreshold
    ? Number(config.freeDeliveryThreshold)
    : null;

  // Calculate totals
  let subtotal = 0;
  for (const item of data.items) {
    const product = productMap.get(item.productId)!;
    subtotal += Number(product.price) * item.quantity;
  }

  const actualDeliveryCharge =
    freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold ? 0 : deliveryCharge;
  const total = subtotal + actualDeliveryCharge;
  const orderNumber = generateOrderNumber();

  // Create order in transaction
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Decrement stock for tracked products
      for (const item of data.items) {
        const product = productMap.get(item.productId)!;
        if (product.trackStock) {
          const updated = await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          if (updated.stockQuantity < 0) {
            throw new Error(`STOCK_UNDERFLOW:${product.name}`);
          }
        }
      }

      const newOrder = await tx.order.create({
        data: {
          businessId: data.businessId,
          orderNumber,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          deliveryAddress: data.deliveryAddress,
          subtotal,
          deliveryCharge: actualDeliveryCharge,
          total,
          paymentMethod: data.paymentMethod,
          paymentStatus: 'PENDING',
          fulfillmentStatus: 'NEW',
          channel: data.channel,
          transactionId: data.transactionId,
          messengerSenderId: data.messengerSenderId,
          statusHistory: [{ status: 'NEW', timestamp: new Date().toISOString(), note: 'Order placed' }],
          items: {
            create: data.items.map((item) => {
              const product = productMap.get(item.productId)!;
              return {
                productId: item.productId,
                productName: product.name,
                variantLabel: item.variantLabel,
                price: Number(product.price),
                quantity: item.quantity,
                imageUrl: product.images[0] ?? null,
              };
            }),
          },
        },
        include: { items: { include: { product: true } } },
      });

      await tx.activityLog.create({
        data: {
          businessId: data.businessId,
          type: 'ORDER_NEW',
          title: 'New Order',
          description: `Order #${orderNumber} from ${data.customerName}`,
          actionUrl: `/dashboard/orders?orderId=${newOrder.id}`,
          actionLabel: 'View Order',
          metadata: { orderId: newOrder.id, total, channel: data.channel },
        },
      });

      return newOrder;
    }, { timeout: 15000, maxWait: 10000 });

    // Fire-and-forget emails
    (async () => {
      try {
        const storeConfig = await getStoreConfigForEmail(data.businessId);
        if (storeConfig) {
          await sendOrderConfirmationEmail(order, storeConfig);
        }
      } catch (err) {
        console.error('Post-order email error:', err);
      }
    })();

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.startsWith('STOCK_UNDERFLOW')) {
      return NextResponse.json(
        { error: `Insufficient stock: ${message.split(':')[1]}`, code: 'STOCK_UNDERFLOW' },
        { status: 409 },
      );
    }
    // Prisma unique constraint or other DB errors
    console.error('Order creation failed:', err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH HANDLER — status update (auth required)
// ─────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const { params: segments } = await params;
  const seg = segments ?? [];

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const businessId = session.user.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'No business found' }, { status: 403 });
  }

  const orderId = seg[0];
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const { status: newStatus, note } = parsed.data;

  // Fetch existing order (ownership check)
  const existingOrder = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { items: { include: { product: true } } },
  });

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Validate status transition
  const currentStatus = existingOrder.fulfillmentStatus;
  if (currentStatus === 'DELIVERED' || currentStatus === 'CANCELLED') {
    return NextResponse.json(
      { error: 'Cannot update a terminal order status', code: 'TERMINAL_STATUS' },
      { status: 400 },
    );
  }

  if (newStatus !== 'CANCELLED') {
    const nextAllowed = getNextFulfillmentStatus(currentStatus);
    if (nextAllowed !== newStatus) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentStatus} to ${newStatus}. Expected ${nextAllowed ?? 'none'}.`,
          code: 'INVALID_TRANSITION',
        },
        { status: 400 },
      );
    }
  }

  // Append to statusHistory
  const existingHistory = Array.isArray(existingOrder.statusHistory)
    ? (existingOrder.statusHistory as Array<{ status: string; timestamp: string; note?: string }>)
    : [];

  const updatedHistory = [
    ...existingHistory,
    {
      status: newStatus,
      timestamp: new Date().toISOString(),
      ...(note ? { note } : {}),
    },
  ];

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: newStatus as FulfillmentStatus,
      statusHistory: updatedHistory,
    },
    include: { items: { include: { product: true } } },
  });

  // Create activity log
  await prisma.activityLog.create({
    data: {
      businessId,
      type: 'ORDER_STATUS_CHANGE',
      title: 'Order Status Updated',
      description: `Order #${existingOrder.orderNumber} → ${STATUS_LABELS[newStatus] ?? newStatus}`,
      actionUrl: `/dashboard/orders?orderId=${orderId}`,
      actionLabel: 'View Order',
      metadata: { orderId, previousStatus: currentStatus, newStatus },
    },
  });

  // Customer notifications (fire-and-forget)
  (async () => {
    try {
      const storeConfig = await getStoreConfigForEmail(businessId);
      if (!storeConfig) return;

      if (existingOrder.channel === 'MESSENGER' && existingOrder.messengerSenderId) {
        await sendMessengerStatusNotification(
          existingOrder.messengerSenderId,
          businessId,
          existingOrder.orderNumber,
          newStatus,
          {
            total: Number(existingOrder.total),
            deliveryAddress: existingOrder.deliveryAddress,
            paymentMethod: existingOrder.paymentMethod,
            items: existingOrder.items.map((i) => ({
              productName: i.productName,
              quantity: i.quantity,
              price: Number(i.price),
            })),
          },
        );
      } else {
        await sendOrderStatusEmail(updatedOrder, storeConfig);
      }
    } catch (err) {
      console.error('Status notification failed:', err);
    }
  })();

  return NextResponse.json({ data: updatedOrder });
}

// ─────────────────────────────────────────────
// PUT HANDLER — internal notes update (auth required)
// ─────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const { params: segments } = await params;
  const seg = segments ?? [];

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const businessId = session.user.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'No business found' }, { status: 403 });
  }

  const orderId = seg[0];
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateNotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  // Ownership check
  const existing = await prisma.order.findFirst({ where: { id: orderId, businessId } });
  if (!existing) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { internalNotes: parsed.data.internalNotes },
    include: { items: { include: { product: true } } },
  });

  return NextResponse.json({ data: updated });
}