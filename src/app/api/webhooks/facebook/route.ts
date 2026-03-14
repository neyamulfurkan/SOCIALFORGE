import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { CACHE_TTL, AI_MODELS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { getGroqKey } from '@/lib/platform-config';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type MessengerSession = {
  messages: Array<{ role: string; content: string }>;
};

type MessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
  };
  delivery?: unknown;
  read?: unknown;
  postback?: { payload: string; title: string };
};

type WebhookEntry = {
  id: string;
  messaging?: MessagingEvent[];
};

type WebhookBody = {
  object: string;
  entry?: WebhookEntry[];
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.META_APP_SECRET ?? '';
  const expected =
    'sha256=' +
    createHmac('sha256', secret).update(rawBody).digest('hex');
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

async function sendMessengerMessage(
  senderId: string,
  text: string,
  pageToken: string,
): Promise<void> {
  await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: { text },
      access_token: pageToken,
    }),
  });
}

async function sendProductCarousel(
  senderId: string,
  products: Array<{
    name: string;
    price: number;
    imageUrl: string;
    slug: string;
    description: string | null;
  }>,
  storeUrl: string,
  pageToken: string,
): Promise<void> {
  const elements = products.slice(0, 10).map((p) => {
    // Build clean Cloudinary image URL for Messenger
    const imageUrl = buildMessengerImageUrl(p.imageUrl);
    const price = '৳' + Number(p.price).toLocaleString();
    const productUrl = `${storeUrl}/products/${p.slug}`;
    const subtitle = p.description
      ? p.description.slice(0, 80) + (p.description.length > 80 ? '...' : '')
      : price;

    return {
      title: `${p.name} — ${price}`,
      subtitle,
      image_url: imageUrl,
      buttons: [
        {
          type: 'web_url',
          url: productUrl,
          title: '🛒 View & Order',
        },
        {
          type: 'postback',
          title: '💬 Ask About This',
          payload: `ASK_PRODUCT:${p.name}:${price}`,
        },
      ],
    };
  });

  await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements,
          },
        },
      },
      access_token: pageToken,
    }),
  });
}

function buildMessengerImageUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  // Already a full URL — apply Cloudinary square crop for Messenger cards
  if (imageUrl.startsWith('http')) {
    const uploadMarker = '/upload/';
    const idx = imageUrl.indexOf(uploadMarker);
    if (idx === -1) return imageUrl;
    const base = imageUrl.slice(0, idx + uploadMarker.length);
    const afterUpload = imageUrl.slice(idx + uploadMarker.length);
    const segments = afterUpload.split('/');
    const cleanSegments = segments.filter((seg) => {
      if (/^v\d+$/.test(seg)) return false;
      if (seg.includes('_')) return false;
      return true;
    });
    return base + 'c_fill,ar_1:1,w_800,f_auto,q_auto/' + cleanSegments.join('/');
  }
  // Bare public ID
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,ar_1:1,w_800,f_auto,q_auto/${imageUrl}`;
}

function shouldShowCarousel(message: string): boolean {
  const lower = message.toLowerCase();
  const triggers = [
    'product', 'products', 'show', 'list', 'catalog', 'catalogue',
    'what do you sell', 'what do you have', 'available', 'items',
    'collection', 'shop', 'buy', 'purchase', 'price', 'prices',
    'পণ্য', 'দেখাও', 'কি আছে', 'কি পাওয়া যায়', 'দাম',
  ];
  return triggers.some((t) => lower.includes(t));
}

async function buildSystemPrompt(
  businessConfig: Awaited<ReturnType<typeof prisma.businessConfig.findFirst>> & {
    business: { name: string; slug: string };
  },
  businessId: string,
): Promise<string> {
  const storeName = businessConfig.business.name;
  const storeSlug = businessConfig.business.slug;
  const storeUrl = `${process.env.NEXTAUTH_URL ?? 'https://socialforge3.vercel.app'}/${storeSlug}`;

  // Fetch all active products with variants
  const products = await prisma.product.findMany({
    where: { businessId, status: 'ACTIVE' },
    include: { variants: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Build product catalog section
  const productLines = products.map((p) => {
    const price = `৳${Number(p.price).toLocaleString()}`;
    const compareAt = p.compareAtPrice
      ? ` (was ৳${Number(p.compareAtPrice).toLocaleString()})`
      : '';
    const stock =
      p.trackStock
        ? p.stockQuantity > 0
          ? ` — ${p.stockQuantity} in stock`
          : ' — OUT OF STOCK'
        : '';
    const variants =
      p.variants.length > 0
        ? '\n    Variants: ' +
          p.variants
            .map((v) => {
              const opts = Array.isArray(v.options)
                ? (v.options as string[]).join(', ')
                : JSON.stringify(v.options);
              return `${v.name}: ${opts}`;
            })
            .join(' | ')
        : '';
    const desc = p.description ? `\n    Description: ${p.description}` : '';
    const category = p.category ? `\n    Category: ${p.category}` : '';
    const productUrl = `${storeUrl}/products/${p.slug}`;
    return `• ${p.name} — ${price}${compareAt}${stock}${category}${desc}${variants}\n    Link: ${productUrl}`;
  });

  const catalogSection =
    products.length > 0
      ? `\n\nPRODUCT CATALOG (${products.length} products):\n${productLines.join('\n\n')}`
      : '\n\nNo products are currently available in the store.';

  // Build delivery section
  const deliveryCharge = Number(businessConfig.deliveryCharge ?? 0);
  const freeThreshold = businessConfig.freeDeliveryThreshold
    ? Number(businessConfig.freeDeliveryThreshold)
    : null;
  const deliveryTime = businessConfig.deliveryTimeMessage ?? 'Contact us for delivery time.';

  const deliverySection =
    `\n\nDELIVERY INFORMATION:\n` +
    `• Delivery charge: ৳${deliveryCharge}` +
    (freeThreshold ? ` (FREE for orders above ৳${freeThreshold})` : '') +
    `\n• Delivery time: ${deliveryTime}`;

  // Build payment methods section
  const paymentMethods: string[] = [];
  if (businessConfig.cashOnDelivery) paymentMethods.push('Cash on Delivery (COD)');
  if (businessConfig.bkashNumber) {
    paymentMethods.push(
      `bKash — Send to: ${businessConfig.bkashNumber}` +
        (businessConfig.bkashInstructions
          ? ` — Instructions: ${businessConfig.bkashInstructions}`
          : ''),
    );
  }
  if (businessConfig.nagadNumber) {
    paymentMethods.push(
      `Nagad — Send to: ${businessConfig.nagadNumber}` +
        (businessConfig.nagadInstructions
          ? ` — Instructions: ${businessConfig.nagadInstructions}`
          : ''),
    );
  }
  if (businessConfig.stripePublicKey) paymentMethods.push('Credit/Debit Card (Stripe)');

  const paymentSection =
    paymentMethods.length > 0
      ? `\n\nPAYMENT METHODS:\n${paymentMethods.map((m) => `• ${m}`).join('\n')}`
      : '\n\nPayment methods: Contact us for payment details.';

  // Build knowledge base section
  const knowledgeBase = businessConfig.knowledgeBase as Array<{
    question: string;
    answer: string;
  }> | null;

  const kbSection =
    knowledgeBase && knowledgeBase.length > 0
      ? `\n\nFREQUENTLY ASKED QUESTIONS:\n` +
        knowledgeBase
          .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
          .join('\n\n')
      : '';

  // Get personality hint
  const personality = businessConfig.chatbotPersonality ?? 'friendly';
  const language = businessConfig.chatbotLanguage ?? 'en';

  const personalityMap: Record<string, string> = {
    friendly: 'You are warm, friendly, and approachable. Use a conversational tone.',
    professional: 'You are professional, formal, and trustworthy. Be precise and helpful.',
    playful: 'You are playful, fun, and energetic. Use emojis occasionally.',
    minimal: 'You are direct and concise. Give short, clear answers.',
  };

  const personalityHint =
    personalityMap[personality] ?? personalityMap.friendly;

  return (
    `You are the AI assistant for ${storeName}, an online store. ` +
    `${personalityHint} ` +
    `Reply in language: ${language}. ` +
    `Keep replies concise for Messenger — avoid very long responses. ` +
    `When a customer asks about a product, always include the price and product link. ` +
    `When a customer wants to order, guide them to the store: ${storeUrl} ` +
    `or ask for their: full name, phone number, delivery address, and preferred payment method. ` +
    `Never make up products or prices — only use what is listed below. ` +
    `If something is out of stock, say so clearly and suggest alternatives if available.` +
    catalogSection +
    deliverySection +
    paymentSection +
    kbSection +
    `\n\nSTORE LINKS:\n• Homepage: ${storeUrl}\n• All products: ${storeUrl}/products`
  );
}

async function processMessagingEvent(
  event: MessagingEvent,
  pageId: string,
): Promise<void> {
  if (event.message?.is_echo) return;
  if (event.delivery || event.read) return;
  if (!event.message?.text) return;

  const senderId = event.sender.id;
  const messageText = event.message.text;
  const messageMid = event.message.mid;

  // Find the business by Facebook page ID
  const businessConfig = await prisma.businessConfig.findFirst({
    where: { facebookPageId: pageId },
    include: { business: true },
  });

  if (!businessConfig || !businessConfig.facebookPageToken) return;
  if (!businessConfig.messengerEnabled) return;

  const businessId = businessConfig.businessId;

  // Load conversation session from Redis
  const sessionKey = `messenger:${businessId}:${senderId}`;
  const sessionData: MessengerSession =
    (await redis.get<MessengerSession>(sessionKey)) ?? { messages: [] };

  // Keep last 20 messages for context
  const historyWindow = sessionData.messages.slice(-20);
  historyWindow.push({ role: 'user', content: messageText });

  // Build full system prompt with all store data
  const systemPrompt = await buildSystemPrompt(
    businessConfig as typeof businessConfig & { business: { name: string; slug: string } },
    businessId,
  );

  // Fetch Groq key and generate reply
  // Fetch Groq key and generate reply
  const groqKey = await getGroqKey('MESSENGER', businessId);
  const groq = createGroq({ apiKey: groqKey });

  const { text: reply } = await generateText({
    model: groq(AI_MODELS.MESSENGER),
    system: systemPrompt,
    messages: historyWindow.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  // Send text reply first
  await sendMessengerMessage(senderId, reply, businessConfig.facebookPageToken);

  // If customer is asking about products, send a carousel after the text reply
  if (shouldShowCarousel(messageText)) {
    const storeUrl = `${process.env.NEXTAUTH_URL ?? 'https://socialforge3.vercel.app'}/${businessConfig.business.slug}`;
    const products = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const carouselProducts = products
      .filter((p) => p.images && (p.images as string[]).length > 0)
      .map((p) => ({
        name: p.name,
        price: Number(p.price),
        imageUrl: (p.images as string[])[0],
        slug: p.slug,
        description: p.description,
      }));

    if (carouselProducts.length > 0) {
      await sendProductCarousel(
        senderId,
        carouselProducts,
        storeUrl,
        businessConfig.facebookPageToken,
      );
    }
  }

  // Update Redis session
  const updatedMessages = [
    ...historyWindow,
    { role: 'assistant', content: reply },
  ];
  await redis.setex(
    sessionKey,
    CACHE_TTL.MESSENGER_SESSION,
    JSON.stringify({ messages: updatedMessages }),
  );

  // Upsert conversation in DB
  const conversation = await prisma.messengerConversation.upsert({
    where: { businessId_senderId: { businessId, senderId } },
    update: {
      lastMessageAt: new Date(),
      lastMessagePreview: messageText.slice(0, 100),
      unreadCount: { increment: 1 },
    },
    create: {
      businessId,
      senderId,
      lastMessageAt: new Date(),
      lastMessagePreview: messageText.slice(0, 100),
      status: 'OPEN',
      unreadCount: 1,
    },
  });

  // Save customer message
  await prisma.messengerMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'CUSTOMER',
      content: messageText,
      timestamp: new Date(),
      mid: messageMid,
    },
  });

  // Save bot reply
  await prisma.messengerMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'BOT',
      content: reply,
      timestamp: new Date(),
    },
  });

  // Activity log
  await prisma.activityLog.create({
    data: {
      businessId,
      type: 'MESSENGER_MESSAGE',
      title: 'New Messenger message',
      description: `Message from ${senderId}: ${messageText.slice(0, 60)}`,
      metadata: { senderId, pageId },
    },
  });
}

// ─────────────────────────────────────────────
// GET — Webhook verification
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    token === process.env.META_APP_SECRET &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ─────────────────────────────────────────────
// POST — Incoming Messenger messages
// ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const signature = req.headers.get('x-hub-signature-256') ?? '';
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody) as WebhookBody;

    if (body.object !== 'page') {
      return NextResponse.json({ status: 'ok' });
    }

    const entries = body.entry ?? [];

    for (const entry of entries) {
      const pageId = entry.id;
      const messagingEvents = entry.messaging ?? [];

      for (const event of messagingEvents) {
        try {
          await processMessagingEvent(event, pageId);
        } catch (eventErr) {
          console.error(
            `Messenger webhook: error processing event from ${event.sender?.id}:`,
            eventErr,
          );
        }
      }
    }
  } catch (err) {
    console.error('Messenger webhook: fatal processing error:', err);
  }

  return NextResponse.json({ status: 'ok' });
}