import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { auth } from '@/lib/auth';
import { setConfigValue, clearConfigCache } from '@/lib/platform-config';
import { generateSlug } from '@/lib/utils';

// ─────────────────────────────────────────────
// INLINE ZOD SCHEMAS
// ─────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  storeName: z.string().min(1),
});

const platformConfigSchema = z.object({
  key: z.enum([
    'GROQ_KEY_CHATBOT',
    'GROQ_KEY_DESCRIPTIONS',
    'GROQ_KEY_SOCIAL',
    'GROQ_KEY_MESSENGER',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'RESEND_API_KEY',
    'STRIPE_PLATFORM_KEY',
  ]),
  value: z.string().min(1),
});

const featureFlagSchema = z.object({
  flagKey: z.string().min(1),
  enabled: z.boolean(),
  businessId: z.string().optional(),
});

const updateBusinessSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  tagline: z.string().optional(),
  accentColor: z.string().optional(),
  domain: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  heroImages: z.array(z.string()).optional(),
});

const updateBusinessConfigSchema = z.object({
  chatbotPersonality: z.string().optional(),
  chatbotWelcomeMessage: z.string().optional(),
  chatbotLanguage: z.string().optional(),
  knowledgeBase: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  deliveryCharge: z.number().optional(),
  freeDeliveryThreshold: z.number().optional().nullable(),
  deliveryTimeMessage: z.string().optional().nullable(),
  cashOnDelivery: z.boolean().optional(),
  bkashNumber: z.string().optional().nullable(),
  bkashInstructions: z.string().optional().nullable(),
  nagadNumber: z.string().optional().nullable(),
  nagadInstructions: z.string().optional().nullable(),
  stripePublicKey: z.string().optional().nullable(),
  stripeSecretKey: z.string().optional().nullable(),
  facebookPageId: z.string().optional().nullable(),
  facebookPageToken: z.string().optional().nullable(),
  instagramAccountId: z.string().optional().nullable(),
  messengerEnabled: z.boolean().optional(),
  socialAutoApprove: z.boolean().optional(),
  defaultPostTime: z.string().optional(),
  notificationEmail: z.string().optional().nullable(),
  notifyOnOrder: z.boolean().optional(),
  notifyOnMessage: z.boolean().optional(),
});

const businessStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']),
});

const businessPlanSchema = z.object({
  plan: z.enum(['TRIAL', 'STARTER', 'PRO']),
  planExpiresAt: z.string().datetime().optional().nullable(),
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function maskValue(value: string): string {
  return '••••••';
}

function generateImpersonationToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function logActivity(
  businessId: string,
  title: string,
  description: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        businessId,
        type: 'SYSTEM',
        title,
        description,
        metadata: (metadata ?? {}) as object,
      },
    });
  } catch {
    // Non-critical — do not throw
  }
}

async function requireSuperAdmin(
  request: NextRequest,
): Promise<{ error: NextResponse } | { session: NonNullable<Awaited<ReturnType<typeof auth>>> }> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { session: session as unknown as NonNullable<Awaited<ReturnType<typeof auth>>> };
}

// ─────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const { params: segments } = await params;
  const [resource, resourceId, subResource] = segments ?? [];

  // ── Public: no auth needed ──────────────────
  // (no public GET routes on admin — all require super admin)

  const check = await requireSuperAdmin(request);
  if ('error' in check) return check.error;

  // ── GET /api/admin/businesses ───────────────
  if (resource === 'businesses' && !resourceId) {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') ?? '20'));
    const search = searchParams.get('search') ?? '';
    const plan = searchParams.get('plan') ?? '';
    const skip = (page - 1) * pageSize;

    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(plan ? { plan: plan as 'TRIAL' | 'STARTER' | 'PRO' } : {}),
    };

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { email: true, name: true } },
          _count: { select: { orders: true } },
        },
      }),
      prisma.business.count({ where }),
    ]);

    // Fetch revenue sums per business
    const businessIds = businesses.map((b) => b.id);
    const revenueSums = await prisma.order.groupBy({
      by: ['businessId'],
      where: { businessId: { in: businessIds } },
      _sum: { total: true },
    });
    const revenueMap = new Map(
      revenueSums.map((r) => [r.businessId, Number(r._sum.total ?? 0)]),
    );

    // Last activity per business
    const lastActivities = await prisma.activityLog.findMany({
      where: { businessId: { in: businessIds } },
      distinct: ['businessId'],
      orderBy: { createdAt: 'desc' },
      select: { businessId: true, createdAt: true },
    });
    const lastActiveMap = new Map(lastActivities.map((a) => [a.businessId, a.createdAt]));

    const rows = businesses.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      plan: b.plan,
      status: b.status,
      createdAt: b.createdAt,
      orderCount: b._count.orders,
      totalRevenue: revenueMap.get(b.id) ?? 0,
      lastActive: lastActiveMap.get(b.id) ?? null,
      ownerEmail: b.owner?.email ?? null,
    }));

    return NextResponse.json({
      data: rows,
      total,
      page,
      pageSize,
      hasMore: skip + pageSize < total,
    });
  }

  // ── GET /api/admin/businesses/:id ──────────
  if (resource === 'businesses' && resourceId && !subResource) {
    const business = await prisma.business.findUnique({
      where: { id: resourceId },
      include: {
        owner: { select: { id: true, email: true, name: true, createdAt: true } },
        config: true,
        platformConfig: true,
        _count: { select: { orders: true, products: true, posts: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const revenueAgg = await prisma.order.aggregate({
      where: { businessId: resourceId },
      _sum: { total: true },
    });

    const lastActivity = await prisma.activityLog.findFirst({
      where: { businessId: resourceId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return NextResponse.json({
      data: {
        ...business,
        totalRevenue: Number(revenueAgg._sum.total ?? 0),
        lastActive: lastActivity?.createdAt ?? null,
      },
    });
  }

  // ── GET /api/admin/platform-config ─────────
  if (resource === 'platform-config') {
    const configs = await prisma.platformConfig.findMany({
      where: { businessId: null },
      orderBy: { key: 'asc' },
    });

    return NextResponse.json({
      data: configs.map((c) => ({
        key: c.key,
        masked: maskValue(c.value),
        updatedAt: c.updatedAt,
      })),
    });
  }

  // ── GET /api/admin/feature-flags ───────────
  if (resource === 'feature-flags') {
    const [globalFlags, allBusinessOverrides] = await Promise.all([
      prisma.platformConfig.findMany({
        where: { businessId: null, key: { startsWith: 'flag:' } },
      }),
      prisma.platformConfig.findMany({
        where: { businessId: { not: null }, key: { startsWith: 'flag:' } },
      }),
    ]);

    const flagMap = new Map<string, { 
    key: string; 
    label: string; 
    enabled: boolean; 
    businessOverrides: Array<{ businessId: string; enabled: boolean }> 
}>();

    for (const f of globalFlags) {
      const label = f.key.replace('flag:', '').replace(/-/g, ' ');
      flagMap.set(f.key, {
        key: f.key,
        label,
        enabled: f.value === 'true',
        businessOverrides: [],
      });
    }

    for (const f of allBusinessOverrides) {
      if (!flagMap.has(f.key)) {
        flagMap.set(f.key, {
          key: f.key,
          label: f.key.replace('flag:', '').replace(/-/g, ' '),
          enabled: false,
          businessOverrides: [],
        });
      }
      flagMap.get(f.key)!.businessOverrides.push({
        businessId: f.businessId!,
        enabled: f.value === 'true',
      });
    }

    return NextResponse.json({ data: Array.from(flagMap.values()) });
  }

  // ── GET /api/admin/billing ──────────────────
  if (resource === 'billing') {
    const businesses = await prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        planExpiresAt: true,
        status: true,
        createdAt: true,
        owner: { select: { email: true } },
      },
    });

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const summary = {
      totalActive: businesses.filter((b) => b.status === 'ACTIVE').length,
      expiringIn7Days: businesses.filter(
        (b) =>
          b.planExpiresAt &&
          b.planExpiresAt > now &&
          b.planExpiresAt <= sevenDaysFromNow,
      ).length,
    };

    return NextResponse.json({ data: businesses, summary });
  }

  // ── GET /api/admin/impersonate/:businessId ──
  if (resource === 'impersonate' && resourceId) {
    const business = await prisma.business.findUnique({
      where: { id: resourceId },
      select: { id: true, name: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const token = generateImpersonationToken();
    const ttl = 900; // 15 minutes

    await redis.setex(`impersonate:${token}`, ttl, resourceId);

    return NextResponse.json({ data: { token, businessId: resourceId, businessName: business.name } });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const { params: segments } = await params;
  const [resource] = segments ?? [];

  // ── POST /api/admin/change-password (authenticated) ─────────────────────
  if (resource === 'change-password') {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const changePasswordSchema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    });

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { compare } = await import('bcryptjs');
    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newHash = await hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: newHash },
    });

    return NextResponse.json({ data: { success: true } });
  }

  // ── POST /api/admin/register (PUBLIC) ───────
  if (resource === 'register') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { name, email, password, storeName } = parsed.data;

    try {
      const passwordHash = await hash(password, 10);
      let slug = generateSlug(storeName);

      // Ensure slug uniqueness
      let attempts = 0;
      while (await prisma.business.findUnique({ where: { slug } })) {
        slug = generateSlug(storeName);
        if (++attempts > 5) {
          slug = generateSlug(storeName + Math.floor(Math.random() * 10000));
          break;
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: storeName,
            slug,
            plan: 'TRIAL',
            status: 'ACTIVE',
          },
        });

        const user = await tx.user.create({
          data: {
            name,
            email,
            password: passwordHash,
            role: 'BUSINESS_OWNER',
            businessId: business.id,
          },
        });

        await tx.businessConfig.create({
          data: {
            businessId: business.id,
            chatbotWelcomeMessage: `Welcome to ${storeName}! How can I help you today?`,
            knowledgeBase: [],
          },
        });

        return { userId: user.id, businessId: business.id };
      });

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        return NextResponse.json(
          { error: 'Email already registered', code: 'DUPLICATE_EMAIL' },
          { status: 409 },
        );
      }
      console.error('[register] error:', err);
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }
  }

  // ── POST /api/admin/platform-config (business owner saving their own keys) ──
  if (resource === 'platform-config') {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = platformConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const isSuperAdmin = session.user.role === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      // Super admin sets global key (no businessId)
      await setConfigValue(parsed.data.key, parsed.data.value, undefined);
    } else {
      // Business owner sets key scoped to their own business
      const businessId = session.user.businessId;
      if (!businessId) {
        return NextResponse.json({ error: 'No business associated' }, { status: 403 });
      }
      await setConfigValue(parsed.data.key, parsed.data.value, businessId);
    }

    return NextResponse.json({ data: { success: true } });
  }

  // All routes below require SUPER_ADMIN
  const check = await requireSuperAdmin(request);
  if ('error' in check) return check.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── POST /api/admin/feature-flags ───────────
  if (resource === 'feature-flags') {
    const parsed = featureFlagSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { flagKey, enabled, businessId } = parsed.data;
    const configKey = `flag:${flagKey}`;

    await prisma.platformConfig.upsert({
      where: {
        businessId_key: {
          businessId: businessId ?? null as unknown as string,
          key: configKey,
        },
      },
      update: { value: enabled ? 'true' : 'false' },
      create: {
        businessId: businessId ?? null,
        key: configKey,
        value: enabled ? 'true' : 'false',
      },
    });

    // Invalidate flags cache
    if (businessId) {
      await redis.del(`flags:${businessId}`).catch(() => {});
    } else {
      // Global flag changed — cannot easily clear all per-business caches,
      // so we rely on TTL expiry (CACHE_TTL.FLAGS = 5 min)
    }

    return NextResponse.json({ data: { success: true } });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ─────────────────────────────────────────────
// PUT
// ─────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const { params: segments } = await params;
  const [resource, resourceId, subResource] = segments ?? [];

  // Allow both SUPER_ADMIN and the business owner of this business
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';
  const isOwnerOfBusiness =
    session.user.role === 'BUSINESS_OWNER' &&
    !!session.user.businessId &&
    session.user.businessId === resourceId;

  

  if (!isSuperAdmin && !isOwnerOfBusiness) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── PUT /api/admin/businesses/:id ───────────
  if (resource === 'businesses' && resourceId && !subResource) {
    const parsed = updateBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({ where: { id: resourceId } });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const updated = await prisma.business.update({
      where: { id: resourceId },
      data: parsed.data,
    });

    revalidateTag('store-' + updated.slug);
    await logActivity(resourceId, 'Business Updated', 'Business details updated');

    return NextResponse.json({ data: updated });
  }

  // ── PUT /api/admin/businesses/:id/config ────
  if (resource === 'businesses' && resourceId && subResource === 'config') {
    const parsed = updateBusinessConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const existing = await prisma.businessConfig.findUnique({
      where: { businessId: resourceId },
    });

    let updatedConfig;
    if (existing) {
      updatedConfig = await prisma.businessConfig.update({
        where: { businessId: resourceId },
        data: parsed.data,
      });
    } else {
      updatedConfig = await prisma.businessConfig.create({
        data: {
          businessId: resourceId,
          chatbotWelcomeMessage: '',
          knowledgeBase: [],
          ...parsed.data,
        },
      });
    }

    await logActivity(resourceId, 'Config Updated', 'Business configuration updated');

    return NextResponse.json({ data: updatedConfig });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ─────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const { params: segments } = await params;
  const [resource, resourceId, subResource] = segments ?? [];

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';
  const isOwnerOfBusiness =
    session.user.role === 'BUSINESS_OWNER' &&
    session.user.businessId === resourceId;

  if (!isSuperAdmin && !isOwnerOfBusiness) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (resource !== 'businesses' || !resourceId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const business = await prisma.business.findUnique({ where: { id: resourceId } });
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  // ── PATCH /api/admin/businesses/:id/config ──
  if (subResource === 'config') {
    const parsed = updateBusinessConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const existing = await prisma.businessConfig.findUnique({
      where: { businessId: resourceId },
    });

    let updatedConfig;
    if (existing) {
      updatedConfig = await prisma.businessConfig.update({
        where: { businessId: resourceId },
        data: parsed.data,
      });
    } else {
      updatedConfig = await prisma.businessConfig.create({
        data: {
          businessId: resourceId,
          chatbotWelcomeMessage: '',
          knowledgeBase: [],
          ...parsed.data,
        },
      });
    }

    await logActivity(resourceId, 'Config Updated', 'Business configuration updated');
    return NextResponse.json({ data: updatedConfig });
  }

  // ── PATCH /api/admin/businesses/:id/status — SUPER_ADMIN only ──
  if (subResource === 'status' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── PATCH /api/admin/businesses/:id/plan — SUPER_ADMIN only ──
  if (subResource === 'plan' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── PATCH /api/admin/businesses/:id/status ──
  if (subResource === 'status') {
    const parsed = businessStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const updated = await prisma.business.update({
      where: { id: resourceId },
      data: { status: parsed.data.status },
    });

    await logActivity(
      resourceId,
      'Status Changed',
      `Business status changed to ${parsed.data.status}`,
      { previousStatus: business.status, newStatus: parsed.data.status },
    );

    return NextResponse.json({ data: updated });
  }

  // ── PATCH /api/admin/businesses/:id/plan ────
  if (subResource === 'plan') {
    const parsed = businessPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const updated = await prisma.business.update({
      where: { id: resourceId },
      data: {
        plan: parsed.data.plan,
        planExpiresAt: parsed.data.planExpiresAt
          ? new Date(parsed.data.planExpiresAt)
          : null,
      },
    });

    await logActivity(
      resourceId,
      'Plan Changed',
      `Business plan changed to ${parsed.data.plan}`,
      { previousPlan: business.plan, newPlan: parsed.data.plan },
    );

    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}