import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/redis';
import { RATE_LIMITS, AI_MODELS, IMAGE_TRANSFORMS } from '@/lib/constants';
import { auth } from '@/lib/auth';
import { getGroqKey } from '@/lib/platform-config';

// ─────────────────────────────────────────────
// INLINE ZOD SCHEMAS
// ─────────────────────────────────────────────

const createManualPostSchema = z.object({
  facebookCaption: z.string().min(1),
  instagramCaption: z.string().min(1),
  imageUrls: z.object({
    facebook: z.array(z.string()),
    instagram: z.array(z.string()),
  }),
  scheduledAt: z.string().optional(),
});

const generatePostSchema = z.object({
  productId: z.string().min(1),
});

const regeneratePostSchema = z.object({
  postId: z.string().min(1),
  tone: z.string().optional(),
  length: z.string().optional(),
});

const approvePostSchema = z.object({
  postId: z.string().min(1),
  scheduledAt: z.string().optional(),
});

const schedulePostSchema = z.object({
  postId: z.string().min(1),
  scheduledAt: z.string().min(1),
});

const rejectPostSchema = z.object({
  postId: z.string().min(1),
});

const reschedulePostSchema = z.object({
  postId: z.string().min(1),
  scheduledAt: z.string().min(1),
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function buildImageUrls(
  productImages: string[],
): { facebook: string[]; instagram: string[] } {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? '';

  const transform = (img: string, transform: string): string => {
    // If already a full Cloudinary URL, insert the transform
    if (img.startsWith('https://res.cloudinary.com/')) {
      return img.replace('/image/upload/', `/image/upload/${transform}/`);
    }
    // Otherwise treat as a public ID
    return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${img}`;
  };

  return {
    facebook: productImages.map((img) =>
      transform(img, IMAGE_TRANSFORMS.FACEBOOK_WIDE),
    ),
    instagram: productImages.map((img) =>
      transform(img, IMAGE_TRANSFORMS.INSTAGRAM_PORTRAIT),
    ),
  };
}

async function generateCaptions(
  groqKey: string,
  productName: string,
  category: string,
  description: string | null,
  price: number,
  businessId: string,
  toneHint?: string,
  lengthHint?: string,
): Promise<{ facebookCaption: string; instagramCaption: string }> {
  const toneInstruction = toneHint
    ? `Use a ${toneHint} tone.`
    : '';
  const lengthInstruction = lengthHint === 'short'
    ? 'Keep Facebook caption to 80-100 words and Instagram to 50-60 words.'
    : lengthHint === 'long'
    ? 'Make Facebook caption 200-250 words and Instagram 120-150 words.'
    : 'Facebook caption: 150-200 words. Instagram caption: 80-100 words.';

      const baseUrl = process.env.NEXTAUTH_URL ?? 'https://socialforge3.vercel.app';

  // Build the specific product page URL for this business
  // This requires the business slug and product slug to be passed in
  // We use the businessId to look up the slug from DB
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { slug: true },
  });
  const businessSlug = business?.slug ?? '';
  
  // Generate a URL-safe product slug from the product name
  const productUrlSlug = productName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const productUrl = `${baseUrl}/${businessSlug}/products/${productUrlSlug}`;
  const storeUrl = `${baseUrl}/${businessSlug}`;

  // Unicode bold converter — makes text appear bold on Facebook/Instagram
  // These are Mathematical Bold characters (U+1D400 range) that render
  // as bold on all social platforms without any markup.
  function toBold(text: string): string {
    return text.split('').map(c => {
      const code = c.codePointAt(0) ?? 0;
      if (code >= 65 && code <= 90) return String.fromCodePoint(code - 65 + 0x1D400);  // A-Z
      if (code >= 97 && code <= 122) return String.fromCodePoint(code - 97 + 0x1D41A); // a-z
      if (code >= 48 && code <= 57) return String.fromCodePoint(code - 48 + 0x1D7CE);  // 0-9
      return c;
    }).join('');
  }

  const boldName = toBold(productName);
  const boldPrice = toBold('৳' + price.toLocaleString());

  const prompt = `You are a world-class social media copywriter for a small business in Bangladesh. Generate modern, scroll-stopping captions for a new product listing.

Product: ${productName}
Category: ${category}
Description: ${description ?? 'N/A'}
Price: ৳${price.toLocaleString()}
Bold product name (use this exactly): ${boldName}
Bold price (use this exactly): ${boldPrice}
Store link: ${storeUrl}

${toneInstruction}
${lengthInstruction}

FACEBOOK CAPTION — follow this exact structure:

Line 1: A single bold product + price header using the bold versions provided above. Format: [bold name] ── [bold price]
[blank line]
Line 2-4: A short punchy hook sentence (1 line). Then 1-2 lines describing the product vibe — make it feel desirable, not just descriptive. Use line breaks between each sentence.
[blank line]
Section: 4 benefit lines, each starting with a colored circle emoji followed by a short crisp benefit. Use these circle emojis: 🔵 🟢 🟡 🔴 — one per line. Keep each benefit under 6 words.
[blank line]
Divider line: ━━━━━━━━━━━━━━━━━━━━
[blank line]
CTA line: Use this format exactly: 🛍️ 𝗢𝗿𝗱𝗲𝗿 𝗡𝗼𝘄 👇
[blank line]
Product URL on its own line — this is the direct link to THIS specific product page. Use this exact URL: ${productUrl}
[blank line]
Divider line: ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
[blank line]
Hashtag line: 6-8 hashtags, mix of English and Bengali, most popular first. Keep on one line.

INSTAGRAM CAPTION — follow this exact structure:

Line 1: Eye-catching opener emoji + bold product name + bold price. Format: ✨ [bold name] ✨
Line 2: [bold price] only
[blank line]
2-3 short punchy lines about the product. Each line starts with a relevant emoji. Make it feel aspirational.
[blank line]
3 benefit lines each starting with ◾
[blank line]
CTA: 🔗 𝗧𝗮𝗽 𝗹𝗶𝗻𝗸 𝗶𝗻 𝗯𝗶𝗼 𝘁𝗼 𝗼𝗿𝗱𝗲𝗿!
[blank line]
─ ─ ─ ─ ─ ─ ─ ─ ─ ─
[blank line]
Up to 28 hashtags on one line — mix popular food/lifestyle/local tags ranked by reach.

IMPORTANT RULES:
- Use the exact bold unicode characters provided for the product name and price — copy them character by character
- Never use markdown like ** or __ 
- The ━━━ divider must appear exactly as shown
- The 𝗢𝗿𝗱𝗲𝗿 𝗡𝗼𝘄 and 𝗧𝗮𝗽 𝗹𝗶𝗻𝗸 text must use these exact unicode bold characters as shown
- Keep the whole caption scannable — short lines, lots of whitespace
- Make it feel premium, modern, and local at the same time

Respond ONLY with valid JSON in this exact shape, no markdown, no extra keys:
{"facebookCaption":"...","instagramCaption":"..."}`;

  const groq = createGroq({ apiKey: groqKey });
  const { text } = await generateText({
    model: groq(AI_MODELS.SOCIAL),
    prompt,
    maxTokens: 1000,
  });

  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean) as {
    facebookCaption: string;
    instagramCaption: string;
  };
  return parsed;
}

async function postToFacebook(
  pageId: string,
  pageToken: string,
  imageUrls: string[],
  caption: string,
): Promise<string> {
  // Single image — use /photos endpoint directly
  if (imageUrls.length === 1) {
    const url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: imageUrls[0],
        caption,
        access_token: pageToken,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: { message?: string } }).error?.message ??
          'Facebook post failed',
      );
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  // Multiple images — step 1: upload each image as unpublished photo
  const uploadedIds: string[] = [];
  for (const imgUrl of imageUrls.slice(0, 10)) {
    const photoRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: imgUrl,
          published: false, // unpublished — will attach to feed post
          access_token: pageToken,
        }),
        cache: 'no-store',
      },
    );
    if (!photoRes.ok) {
      const err = await photoRes.json().catch(() => ({}));
      console.error('Photo upload failed:', (err as { error?: { message?: string } }).error?.message);
      continue; // skip failed image, continue with others
    }
    const photoData = (await photoRes.json()) as { id: string };
    uploadedIds.push(photoData.id);
  }

  if (uploadedIds.length === 0) {
    throw new Error('All image uploads failed');
  }

  // Step 2: create a feed post attaching all uploaded photo IDs
  const feedRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: caption,
        attached_media: uploadedIds.map((id) => ({ media_fbid: id })),
        access_token: pageToken,
      }),
      cache: 'no-store',
    },
  );

  if (!feedRes.ok) {
    const err = await feedRes.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        'Facebook multi-image post failed',
    );
  }

  const feedData = (await feedRes.json()) as { id: string };
  return feedData.id;
}

async function postToInstagram(
  instagramAccountId: string,
  pageToken: string,
  imageUrl: string,
  caption: string,
): Promise<string> {
  // Step 1: create media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${instagramAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: pageToken,
      }),
      cache: 'no-store',
    },
  );
  if (!containerRes.ok) {
    const err = await containerRes.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        'Instagram container creation failed',
    );
  }
  const { id: containerId } = (await containerRes.json()) as { id: string };

  // Step 2: publish container
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${instagramAccountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: pageToken,
      }),
      cache: 'no-store',
    },
  );
  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        'Instagram publish failed',
    );
  }
  const { id: postId } = (await publishRes.json()) as { id: string };
  return postId;
}

async function deleteInstagramPost(
  instagramPostId: string,
  pageToken: string,
): Promise<void> {
  await fetch(
    `https://graph.facebook.com/v19.0/${instagramPostId}?access_token=${pageToken}`,
    { method: 'DELETE', cache: 'no-store' },
  ).catch(() => {
    // best-effort rollback — log but do not throw
    console.error('Instagram rollback failed for post:', instagramPostId);
  });
}

// ─────────────────────────────────────────────
// AUTH HELPER
// ─────────────────────────────────────────────

async function getAuthenticatedBusinessId(req?: NextRequest): Promise<string | null> {
  // Allow internal server-to-server calls from the products route
  if (req) {
    const internalSecret = req.headers.get('x-internal-secret');
    const internalBusinessId = req.headers.get('x-internal-business-id');
    if (
      internalSecret &&
      internalSecret === (process.env.CRON_SECRET ?? '') &&
      internalBusinessId
    ) {
      return internalBusinessId;
    }
  }
  const session = await auth();
  return session?.user?.businessId ?? null;
}

// ─────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const businessId = session.user.businessId;

  const { params: segments } = await params;
  const seg = segments ?? [];

  const { searchParams } = new URL(req.url);

  // GET /api/social/calendar
  if (seg[0] === 'calendar') {
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const posts = await prisma.socialPost.findMany({
      where: {
        businessId,
        status: { in: ['SCHEDULED', 'LIVE'] },
        scheduledAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return NextResponse.json({ data: posts });
  }

  // GET /api/social/history
  if (seg[0] === 'history') {
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
    const skip = (page - 1) * pageSize;

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where: { businessId, status: 'LIVE' },
        orderBy: { postedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.socialPost.count({ where: { businessId, status: 'LIVE' } }),
    ]);

    return NextResponse.json({
      data: posts,
      total,
      page,
      pageSize,
      hasMore: skip + posts.length < total,
    });
  }

  // GET /api/social/:postId — single post fetch
  if (seg[0] && seg[0] !== 'calendar' && seg[0] !== 'history') {
    const post = await prisma.socialPost.findFirst({
      where: { id: seg[0], businessId },
    });
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    return NextResponse.json({ data: post });
  }

  // GET /api/social — list with filters
  const status = searchParams.get('status') ?? undefined;
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
  const skip = (page - 1) * pageSize;

  const where = {
    businessId,
    ...(status ? { status: status as never } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.socialPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.socialPost.count({ where }),
  ]);

  return NextResponse.json({
    data: posts,
    total,
    page,
    pageSize,
    hasMore: skip + posts.length < total,
  });
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const businessId = await getAuthenticatedBusinessId(req);
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { params: segments } = await params;
  const seg = segments ?? [];
  const body = await req.json().catch(() => ({}));

  // POST /api/social — create manual draft
  if (!seg[0]) {
    const parsed = createManualPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const { facebookCaption, instagramCaption, imageUrls, scheduledAt } =
      parsed.data;

    const post = await prisma.socialPost.create({
      data: {
        businessId,
        facebookCaption,
        instagramCaption,
        imageUrls: imageUrls as never,
        status: scheduledAt ? 'SCHEDULED' : 'PENDING_REVIEW',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });
    return NextResponse.json({ data: post }, { status: 201 });
  }

  // POST /api/social/generate
  if (seg[0] === 'generate') {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await rateLimit(
      `rl:social:ai:${businessId}:${ip}`,
      RATE_LIMITS.AI.limit,
      RATE_LIMITS.AI.window,
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    const parsed = generatePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const { productId } = parsed.data;

    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
    });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let groqKey: string;
    try {
      groqKey = await getGroqKey('SOCIAL', businessId);
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message, code: 'CONFIG_MISSING' },
        { status: 503 },
      );
    }

    let captions: { facebookCaption: string; instagramCaption: string };
    try {
      captions = await generateCaptions(
        groqKey,
        product.name,
        product.category,
        product.description,
        Number(product.price),
        businessId,
      );
    } catch (err) {
      console.error('Caption generation failed:', err);
      return NextResponse.json(
        { error: 'AI generation failed', code: 'AI_ERROR' },
        { status: 500 },
      );
    }

    const imageUrls = buildImageUrls(product.images);

    const post = await prisma.socialPost.create({
      data: {
        businessId,
        productId,
        facebookCaption: captions.facebookCaption,
        instagramCaption: captions.instagramCaption,
        imageUrls: imageUrls as never,
        status: 'PENDING_REVIEW',
      },
    });
    return NextResponse.json({ data: post }, { status: 201 });
  }

  // POST /api/social/regenerate
  if (seg[0] === 'regenerate') {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await rateLimit(
      `rl:social:ai:${businessId}:${ip}`,
      RATE_LIMITS.AI.limit,
      RATE_LIMITS.AI.window,
    );
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    const parsed = regeneratePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const { postId, tone, length } = parsed.data;

    const post = await prisma.socialPost.findFirst({
      where: { id: postId, businessId },
      include: { business: false },
    });
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Fetch product info if linked, otherwise derive from existing captions
    let productName = 'Product';
    let category = 'General';
    let description: string | null = null;
    let price = 0;

    if (post.productId) {
      const product = await prisma.product.findFirst({
        where: { id: post.productId, businessId },
      });
      if (product) {
        productName = product.name;
        category = product.category;
        description = product.description;
        price = Number(product.price);
      }
    }

    let groqKey: string;
    try {
      groqKey = await getGroqKey('SOCIAL', businessId);
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message, code: 'CONFIG_MISSING' },
        { status: 503 },
      );
    }

    let captions: { facebookCaption: string; instagramCaption: string };
    try {
            captions = await generateCaptions(
        groqKey,
        productName,
        category,
        description,
        price,
        businessId,
        tone,
        length,
      );
    } catch (err) {
      console.error('Caption regeneration failed:', err);
      return NextResponse.json(
        { error: 'AI regeneration failed', code: 'AI_ERROR' },
        { status: 500 },
      );
    }

    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: {
        facebookCaption: captions.facebookCaption,
        instagramCaption: captions.instagramCaption,
      },
    });
    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ─────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const businessId = await getAuthenticatedBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { params: segments } = await params;
  const seg = segments ?? [];
  const body = await req.json().catch(() => ({}));

  // PATCH /api/social/approve
  if (seg[0] === 'approve') {
    const parsed = approvePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const { postId, scheduledAt } = parsed.data;

    const post = await prisma.socialPost.findFirst({
      where: { id: postId, businessId },
    });
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // If scheduledAt provided, just schedule — don't post now
    if (scheduledAt) {
      const updated = await prisma.socialPost.update({
        where: { id: postId },
        data: { status: 'SCHEDULED', scheduledAt: new Date(scheduledAt) },
      });
      return NextResponse.json({ data: updated });
    }

    // Post immediately
    const businessConfig = await prisma.businessConfig.findUnique({
      where: { businessId },
    });
    if (!businessConfig) {
      return NextResponse.json(
        { error: 'Business config not found' },
        { status: 404 },
      );
    }

    const { facebookPageId, facebookPageToken, instagramAccountId } =
      businessConfig;

    const imageUrls = post.imageUrls as {
      facebook: string[];
      instagram: string[];
    };
    const fbImages = imageUrls.facebook ?? [];
    const fbImage = fbImages[0] ?? '';
    const igImage = imageUrls.instagram?.[0] ?? '';

    let facebookPostId: string | null = null;
    let instagramPostId: string | null = null;
    let failed = false;
    let failureReason = '';

    // Attempt Facebook first — it is the primary platform.
    // Instagram is attempted after. If Facebook fails, Instagram is skipped.
    // If Instagram fails after Facebook succeeds, we log but do not rollback Facebook.
    if (facebookPageId && facebookPageToken && fbImages.length > 0) {
      try {
        facebookPostId = await postToFacebook(
          facebookPageId,
          facebookPageToken,
          fbImages,
          post.facebookCaption,
        );
      } catch (err) {
        console.error('Facebook publish failed:', err);
        failed = true;
        failureReason = `Facebook: ${(err as Error).message}`;
      }
    } else if (!facebookPageId || !facebookPageToken) {
      failed = true;
      failureReason = 'Facebook Page ID or Access Token is not configured. Go to Settings → Messenger to connect your Page.';
    } else if (fbImages.length === 0) {
      failed = true;
      failureReason = 'No images available for Facebook post.';
    }

    // Only attempt Instagram if Facebook succeeded
    if (!failed && instagramAccountId && facebookPageToken && igImage) {
      try {
        instagramPostId = await postToInstagram(
          instagramAccountId,
          facebookPageToken,
          igImage,
          post.instagramCaption,
        );
      } catch (err) {
        // Instagram failure does not roll back the Facebook post —
        // log it and continue so at least Facebook is marked LIVE.
        console.error('Instagram publish failed (Facebook succeeded):', err);
        instagramPostId = null;
      }
    }

    if (failed) {
      const updated = await prisma.socialPost.update({
        where: { id: postId },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        {
          error: `Publishing failed: ${failureReason}`,
          data: updated,
          code: 'PUBLISH_FAILED',
        },
        { status: 502 },
      );
    }

    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: 'LIVE',
        postedAt: new Date(),
        facebookPostId,
        instagramPostId,
      },
    });
    return NextResponse.json({ data: updated });
  }

  // PATCH /api/social/schedule
  if (seg[0] === 'schedule') {
    const parsed = schedulePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const { postId, scheduledAt } = parsed.data;

    const post = await prisma.socialPost.findFirst({
      where: { id: postId, businessId },
    });
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'SCHEDULED', scheduledAt: new Date(scheduledAt) },
    });
    return NextResponse.json({ data: updated });
  }

  // PATCH /api/social/reject
  if (seg[0] === 'reject') {
    const parsed = rejectPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const { postId } = parsed.data;

    const post = await prisma.socialPost.findFirst({
      where: { id: postId, businessId },
    });
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: { status: 'REJECTED' },
    });
    return NextResponse.json({ data: updated });
  }

  // PATCH /api/social/reschedule
  if (seg[0] === 'reschedule') {
    const parsed = reschedulePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }
    const { postId, scheduledAt } = parsed.data;

    const post = await prisma.socialPost.findFirst({
      where: { id: postId, businessId, status: 'SCHEDULED' },
    });
    if (!post) {
      return NextResponse.json(
        { error: 'Scheduled post not found' },
        { status: 404 },
      );
    }

    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: { scheduledAt: new Date(scheduledAt) },
    });
    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

// ─────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const businessId = await getAuthenticatedBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await params; // consume params (unused for DELETE)
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get('postId');

  if (!postId) {
    return NextResponse.json(
      { error: 'postId is required', code: 'VALIDATION_ERROR' },
      { status: 400 },
    );
  }

  const post = await prisma.socialPost.findFirst({
    where: {
      id: postId,
      businessId,
      status: { in: ['PENDING_REVIEW', 'REJECTED'] },
    },
  });
  if (!post) {
    return NextResponse.json(
      {
        error: 'Post not found or cannot be deleted in its current status',
        code: 'NOT_FOUND',
      },
      { status: 404 },
    );
  }

  await prisma.socialPost.delete({ where: { id: postId } });
  return NextResponse.json({ data: { deleted: true } });
}