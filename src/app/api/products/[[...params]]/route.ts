import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/redis';
import { RATE_LIMITS } from '@/lib/constants';
import { generateSlug } from '@/lib/utils';
import { auth } from '@/lib/auth';
import { deleteCloudinaryAsset } from '@/lib/cloudinary';
import type { ApiResponse, PaginatedResponse, ProductWithVariants } from '@/lib/types';

// ─────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().optional(),
  description: z.string().optional(),
  price: z.number().positive(),
  compareAtPrice: z.number().nullable().optional(),
  images: z.array(z.string()),
  category: z.string(),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('DRAFT'),
  trackStock: z.boolean().default(false),
  stockQuantity: z.number().int().min(0).default(0),
  variants: z
    .array(
      z.object({
        name: z.string(),
        options: z.array(z.string()),
      }),
    )
    .default([]),
});

const updateProductSchema = createProductSchema.partial();

const patchProductSchema = z.object({
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  trackStock: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function getAuthedBusiness(req: NextRequest): Promise<
  | { businessId: string; error: null }
  | { businessId: null; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.businessId) {
    return {
      businessId: null,
      error: NextResponse.json<ApiResponse<never>>(
        { error: 'Unauthorized' },
        { status: 401 },
      ),
    };
  }
  return { businessId: session.user.businessId, error: null };
}

async function applyRateLimit(req: NextRequest, businessId: string): Promise<NextResponse | null> {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(
    `rl:products:${ip}:${businessId}`,
    RATE_LIMITS.PRODUCTS.limit,
    RATE_LIMITS.PRODUCTS.window,
  );
  if (!rl.success) {
    return NextResponse.json<ApiResponse<never>>(
      { error: 'Rate limit exceeded' },
      { status: 429 },
    );
  }
  return null;
}

async function createProductWithSlug(
  data: z.infer<typeof createProductSchema>,
  businessId: string,
  attempt = 0,
): Promise<ProductWithVariants> {
  const baseSlug = data.slug ?? generateSlug(data.name);
  const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

  try {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId,
          name: data.name,
          slug,
          description: data.description,
          price: data.price,
          compareAtPrice: data.compareAtPrice,
          images: data.images,
          category: data.category,
          status: data.status,
          trackStock: data.trackStock,
          stockQuantity: data.stockQuantity,
        },
        include: { variants: true },
      });

      if (data.variants.length > 0) {
        await tx.productVariant.createMany({
          data: data.variants.map((v) => ({
            productId: product.id,
            name: v.name,
            options: v.options,
          })),
        });
        return tx.product.findUniqueOrThrow({
          where: { id: product.id },
          include: { variants: true },
        });
      }

      return product;
    });
  } catch (err: unknown) {
    const isPrismaUniqueError =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002';

    if (isPrismaUniqueError && attempt < 5) {
      return createProductWithSlug(data, businessId, attempt + 1);
    }
    throw err;
  }
}

function triggerSocialGeneration(productId: string, businessId: string): void {
  // fire-and-forget — do not await
  // Call the internal API with the correct path and a server-side auth header
  fetch(`${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/social/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Pass businessId in a custom header so the social route can
      // authenticate this internal server-to-server call without a session cookie
      'x-internal-business-id': businessId,
      'x-internal-secret': process.env.CRON_SECRET ?? '',
    },
    body: JSON.stringify({ productId }),
  }).catch((err) => {
    console.error('Social generation trigger failed:', err);
  });
}

// ─────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const p = await params;
  const segments = p.params ?? [];

  // ── Public store product listing ──────────────
  if (segments[0] === 'public') {
    const storeSlug = segments[1];
    if (!storeSlug) {
      return NextResponse.json<ApiResponse<never>>(
        { error: 'Store slug required' },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search') ?? undefined;
    const category = url.searchParams.get('category') ?? undefined;
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '20', 10), 50);

    const business = await prisma.business.findUnique({ where: { slug: storeSlug } });
    if (!business || business.status !== 'ACTIVE') {
      return NextResponse.json<ApiResponse<never>>({ error: 'Not found' }, { status: 404 });
    }

    const idsParam = url.searchParams.get('ids');
    const ids = idsParam ? idsParam.split(',').filter(Boolean) : undefined;

    const where = {
      businessId: business.id,
      status: 'ACTIVE' as const,
      ...(ids ? { id: { in: ids } } : {}),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { variants: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    const businessConfig = await prisma.businessConfig.findUnique({
      where: { businessId: business.id },
      select: { deliveryCharge: true, freeDeliveryThreshold: true },
    });

    return NextResponse.json({
      data: products,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      deliveryCharge: businessConfig ? Number(businessConfig.deliveryCharge) : 0,
      freeDeliveryThreshold: businessConfig?.freeDeliveryThreshold
        ? Number(businessConfig.freeDeliveryThreshold)
        : null,
    });
  }

  // ── Authenticated product listing / single fetch ──
  const authed = await getAuthedBusiness(req);
  if (authed.error) return authed.error;
  const { businessId } = authed;

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(
    `rl:products:${ip}`,
    RATE_LIMITS.PRODUCTS.limit,
    RATE_LIMITS.PRODUCTS.window,
  );
  if (!rl.success) {
    return NextResponse.json<ApiResponse<never>>({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Single product
  if (segments.length > 0 && segments[0] !== 'public') {
    const product = await prisma.product.findFirst({
      where: { id: segments[0], businessId },
      include: { variants: true },
    });
    if (!product) {
      return NextResponse.json<ApiResponse<never>>({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<ProductWithVariants>>({ data: product });
  }

  // Product list
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '20', 10), 50);
  const status = url.searchParams.get('status') ?? undefined;
  const category = url.searchParams.get('category') ?? undefined;
  const search = url.searchParams.get('search') ?? undefined;

  const where = {
    businessId,
    ...(status ? { status: status as 'ACTIVE' | 'DRAFT' | 'ARCHIVED' } : {}),
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { variants: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json<PaginatedResponse<ProductWithVariants>>({
    data,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  });
}

// ─────────────────────────────────────────────
// POST — Create product
// ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
): Promise<NextResponse> {
  const authed = await getAuthedBusiness(req);
  if (authed.error) return authed.error;
  const { businessId } = authed;

  const rateLimitError = await applyRateLimit(req, businessId);
  if (rateLimitError) return rateLimitError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { error: 'Validation failed', code: parsed.error.message },
      { status: 400 },
    );
  }

  try {
    const product = await createProductWithSlug(parsed.data, businessId);
    triggerSocialGeneration(product.id, businessId);
    return NextResponse.json<ApiResponse<ProductWithVariants>>({ data: product }, { status: 201 });
  } catch (err) {
    console.error('Product create error:', err);
    return NextResponse.json<ApiResponse<never>>(
      { error: 'Failed to create product' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// PUT — Full update
// ─────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const authed = await getAuthedBusiness(req);
  if (authed.error) return authed.error;
  const { businessId } = authed;

  const rateLimitError = await applyRateLimit(req, businessId);
  if (rateLimitError) return rateLimitError;

  const p = await params;
  const segments = p.params ?? [];
  const productId = segments[0];

  if (!productId) {
    return NextResponse.json<ApiResponse<never>>({ error: 'Product ID required' }, { status: 400 });
  }

  const existing = await prisma.product.findFirst({ where: { id: productId, businessId } });
  if (!existing) {
    return NextResponse.json<ApiResponse<never>>({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { error: 'Validation failed', code: parsed.error.message },
      { status: 400 },
    );
  }

  const { variants, ...productData } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          ...(productData.name !== undefined ? { name: productData.name } : {}),
          ...(productData.slug !== undefined ? { slug: productData.slug } : {}),
          ...(productData.description !== undefined ? { description: productData.description } : {}),
          ...(productData.price !== undefined ? { price: productData.price } : {}),
          ...(productData.compareAtPrice !== undefined
            ? { compareAtPrice: productData.compareAtPrice ?? null }
            : {}),
          ...(productData.images !== undefined ? { images: productData.images } : {}),
          ...(productData.category !== undefined ? { category: productData.category } : {}),
          ...(productData.status !== undefined ? { status: productData.status } : {}),
          ...(productData.trackStock !== undefined ? { trackStock: productData.trackStock } : {}),
          ...(productData.stockQuantity !== undefined
            ? { stockQuantity: productData.stockQuantity }
            : {}),
        },
      });

      if (variants !== undefined) {
        await tx.productVariant.deleteMany({ where: { productId } });
        if (variants.length > 0) {
          await tx.productVariant.createMany({
            data: variants.map((v) => ({
              productId,
              name: v.name,
              options: v.options,
            })),
          });
        }
      }
    }, { timeout: 15000 });

    const updated = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { variants: true },
    });

    return NextResponse.json<ApiResponse<ProductWithVariants>>({ data: updated });
  } catch (err) {
    console.error('Product update error:', err);
    return NextResponse.json<ApiResponse<never>>(
      { error: 'Failed to update product' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// PATCH — Partial update (status, stock)
// ─────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const authed = await getAuthedBusiness(req);
  if (authed.error) return authed.error;
  const { businessId } = authed;

  const rateLimitError = await applyRateLimit(req, businessId);
  if (rateLimitError) return rateLimitError;

  const p = await params;
  const segments = p.params ?? [];
  const productId = segments[0];

  if (!productId) {
    return NextResponse.json<ApiResponse<never>>({ error: 'Product ID required' }, { status: 400 });
  }

  const existing = await prisma.product.findFirst({ where: { id: productId, businessId } });
  if (!existing) {
    return NextResponse.json<ApiResponse<never>>({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<never>>(
      { error: 'Validation failed', code: parsed.error.message },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json<ApiResponse<never>>(
      { error: 'No fields to update' },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      return tx.product.update({
        where: { id: productId },
        data: parsed.data,
        include: { variants: true },
      });
    });

    return NextResponse.json<ApiResponse<ProductWithVariants>>({ data: updated });
  } catch (err) {
    console.error('Product patch error:', err);
    return NextResponse.json<ApiResponse<never>>(
      { error: 'Failed to update product' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// DELETE — Archive (soft delete)
// ─────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const authed = await getAuthedBusiness(req);
  if (authed.error) return authed.error;
  const { businessId } = authed;

  const rateLimitError = await applyRateLimit(req, businessId);
  if (rateLimitError) return rateLimitError;

  const p = await params;
  const segments = p.params ?? [];
  const productId = segments[0];

  if (!productId) {
    return NextResponse.json<ApiResponse<never>>({ error: 'Product ID required' }, { status: 400 });
  }

  const existing = await prisma.product.findFirst({
    where: { id: productId, businessId },
  });
  if (!existing) {
    return NextResponse.json<ApiResponse<never>>({ error: 'Not found' }, { status: 404 });
  }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED' },
    });

    // Best-effort cleanup of old images if they are Cloudinary public IDs
    // (skip if they look like full URLs — callers pass Cloudinary public IDs for deletion)
    const url = new URL(req.url);
    const deleteImages = url.searchParams.get('deleteImages') === 'true';
    if (deleteImages && existing.images.length > 0) {
      await Promise.allSettled(
        existing.images.map((img) => {
          // Extract publicId from Cloudinary URL if needed
          const publicId = img.startsWith('http')
            ? img.split('/upload/')[1]?.split('/').slice(1).join('/')
            : img;
          if (publicId) return deleteCloudinaryAsset(publicId);
          return Promise.resolve();
        }),
      );
    }

    return NextResponse.json<ApiResponse<{ id: string }>>({ data: { id: productId } });
  } catch (err) {
    console.error('Product archive error:', err);
    return NextResponse.json<ApiResponse<never>>(
      { error: 'Failed to archive product' },
      { status: 500 },
    );
  }
}