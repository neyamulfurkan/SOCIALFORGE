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

// Extract product slugs the AI embedded in its reply via %%CAROUSEL%%[...]%%END%%
// Returns null if the tag is absent (meaning: do not show a carousel)
function extractCarouselSlugs(replyText: string): string[] | null {
  const match = replyText.match(/%%CAROUSEL%%([\s\S]*?)%%END%%/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as unknown[])
        .filter((s): s is string => typeof s === 'string' && s.length > 0);
    }
  } catch {
    // malformed tag — ignore
  }
  return null;
}

// Strip the carousel tag from the visible reply text before sending
function stripCarouselTag(replyText: string): string {
  return replyText
    .replace(/\n?%%CAROUSEL%%[\s\S]*?%%END%%/g, '')
    .replace(/\n?%%ORDER%%[\s\S]*?%%END%%/g, '')
    .trim();
}

type OrderTag = {
  productSlug: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: string;
  transactionId: string | null;
};

// Extract order data the AI embedded in its reply
function extractOrderTag(replyText: string): OrderTag | null {
  const match = replyText.match(/%%ORDER%%([\s\S]*?)%%END%%/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (
      !parsed.productSlug ||
      !parsed.customerName ||
      !parsed.customerPhone ||
      !parsed.deliveryAddress ||
      !parsed.paymentMethod
    ) {
      return null;
    }
    // Reject bKash/Nagad orders with no transaction ID
    const method = (parsed.paymentMethod as string).toUpperCase();
    if ((method === 'BKASH' || method === 'NAGAD') && !parsed.transactionId) {
      console.warn('[Webhook] ORDER tag rejected — bKash/Nagad order missing transactionId');
      return null;
    }
    return parsed as OrderTag;
  } catch {
    // malformed tag
  }
  return null;
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
    `FORMATTING RULES — follow these strictly:\n` +
    `- Keep replies short and conversational. Maximum 3 sentences for simple questions.\n` +
    `- NEVER list products with URLs or links in your text. URLs are ugly in Messenger.\n` +
    `- NEVER use numbered lists like "1. product - price: url". This looks unprofessional.\n` +
    `- NEVER use markdown formatting like **bold** or bullet points starting with •.\n` +
    `- When mentioning products, say the name and price naturally in a sentence. Example: "We have the Cheesy Burger for ৳50 and Fried Rice for ৳150."\n` +
    `- Product cards with images and order buttons will be shown automatically below your text — you do NOT need to include links.\n` +
    `- For delivery, payment, or policy questions: answer directly in 1-2 clean sentences.\n` +
    `- When you cannot help: say "Please contact us directly for this." Do not apologize repeatedly.\n` +
    `When a customer wants to order, ask for: full name, phone number, and delivery address. ` +
    `Never make up products or prices — only use what is listed in the catalog. ` +
    `If something is out of stock, say so clearly in one sentence and suggest an alternative by name. ` +
    `CAROUSEL RULE: When your reply mentions or recommends specific products, append this tag on a new line at the very end (nothing else after it): ` +
    `%%CAROUSEL%%["slug1","slug2"]%%END%% ` +
    `Only include slugs of products you actually mentioned. ` +
    `If the customer asks to see all products, include all available slugs up to 8. ` +
    `If your reply mentions no products, do NOT include the tag. ` +
    `Slugs must exactly match those listed in the catalog below.\n` +
    `ORDER RULE: When a customer wants to order, you must collect ALL of the following step by step: ` +
    `(1) product name and quantity, (2) full name, (3) phone number, (4) delivery address, ` +
    `(5) payment method — tell them the available options are: ${[
      businessConfig.cashOnDelivery ? 'Cash on Delivery (COD)' : '',
      businessConfig.bkashNumber ? `bKash (send to ${businessConfig.bkashNumber})` : '',
      businessConfig.nagadNumber ? `Nagad (send to ${businessConfig.nagadNumber})` : '',
    ].filter(Boolean).join(', ')}. ` +
    `If the customer chooses bKash or Nagad: tell them to send the payment first, then ask for their transaction ID (TrxID). ` +
    `For COD: no transaction ID needed. ` +
    `Only append the ORDER tag when you have ALL required info including transactionId for bKash/Nagad. ` +
    `MUST append this tag on a new line at the very end when order is complete: ` +
    `%%ORDER%%{"productSlug":"slug","quantity":1,"customerName":"name","customerPhone":"phone","deliveryAddress":"address","paymentMethod":"COD","transactionId":null}%%END%% ` +
    `For bKash: paymentMethod="BKASH" and transactionId="the TrxID they gave". ` +
    `For Nagad: paymentMethod="NAGAD" and transactionId="the TrxID they gave". ` +
    `For COD: paymentMethod="COD" and transactionId=null. ` +
    `Never create the order tag without transactionId when payment method is bKash or Nagad. ` +
    `After the tag, confirm the order is placed and thank the customer.` +
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

  // Check if bot is paused for this specific conversation
  const existingConv = await prisma.messengerConversation.findUnique({
    where: { businessId_senderId: { businessId, senderId } },
  });
  if (existingConv?.botPaused) {
    console.log(`[Webhook] Bot paused for sender ${senderId} — skipping AI reply`);
    // Still upsert to record the incoming message, but skip all AI/reply logic
    // Fetch sender profile if missing
    let pausedSenderName: string | null = null;
    let pausedSenderAvatar: string | null = null;
    if (!existingConv?.senderName) {
      const pageId = businessConfig.facebookPageId;
      const pageToken = businessConfig.facebookPageToken;
      // Strategy 1: Conversations API
      try {
        const convRes = await fetch(
          `https://graph.facebook.com/v19.0/${pageId}/conversations?user_id=${senderId}&fields=participants&access_token=${pageToken}`,
        );
        const convData = await convRes.json() as {
          data?: Array<{ participants?: { data?: Array<{ name: string; id: string }> } }>;
          error?: { code?: number };
        };
        if (!convData.error) {
          const participants = convData.data?.[0]?.participants?.data ?? [];
          const userParticipant = participants.find((p) => p.id !== pageId);
          if (userParticipant?.name) {
            pausedSenderName = userParticipant.name;
            pausedSenderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userParticipant.name)}&background=7c3aed&color=fff&size=128&bold=true`;
          }
        }
      } catch {}
      // Strategy 2: Direct profile
      if (!pausedSenderName) {
        try {
          const profileRes = await fetch(
            `https://graph.facebook.com/v19.0/${senderId}?fields=name&access_token=${pageToken}`,
          );
          const profile = await profileRes.json() as { name?: string; error?: unknown };
          if (!(profile as { error?: unknown }).error && profile.name) {
            pausedSenderName = profile.name;
            pausedSenderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=7c3aed&color=fff&size=128&bold=true`;
          }
        } catch {}
      }
      // Strategy 3: Never show "Unknown"
      if (!pausedSenderName) {
        pausedSenderName = `Messenger User`;
        pausedSenderAvatar = `https://ui-avatars.com/api/?name=M+U&background=6b7280&color=fff&size=128&bold=true`;
      }
    } else {
      pausedSenderName = existingConv.senderName;
      pausedSenderAvatar = existingConv.senderAvatar;
    }

    const conv = await prisma.messengerConversation.upsert({
      where: { businessId_senderId: { businessId, senderId } },
      update: {
        lastMessageAt: new Date(),
        lastMessagePreview: messageText.slice(0, 100),
        unreadCount: { increment: 1 },
        ...(pausedSenderName ? { senderName: pausedSenderName } : {}),
        ...(pausedSenderAvatar ? { senderAvatar: pausedSenderAvatar } : {}),
      },
      create: {
        businessId,
        senderId,
        senderName: pausedSenderName,
        senderAvatar: pausedSenderAvatar,
        lastMessageAt: new Date(),
        lastMessagePreview: messageText.slice(0, 100),
        status: 'OPEN',
        unreadCount: 1,
      },
    });
    await prisma.messengerMessage.create({
      data: {
        conversationId: conv.id,
        role: 'CUSTOMER',
        content: messageText,
        timestamp: new Date(),
        mid: messageMid,
      },
    });
    return;
  }

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

  // Parse carousel slugs the AI embedded in its reply
  const carouselSlugs = extractCarouselSlugs(reply);

  // Strip the tag from the visible reply before sending to customer
  const visibleReply = stripCarouselTag(reply);

  // Send text reply first
  await sendMessengerMessage(senderId, visibleReply, businessConfig.facebookPageToken);

  // Create real order if AI collected all required info
  const orderTag = extractOrderTag(reply);
  if (orderTag) {
    try {
      // Find the product by slug
      const product = await prisma.product.findFirst({
        where: { businessId, slug: orderTag.productSlug, status: 'ACTIVE' },
      });

      if (product) {
        const { generateOrderNumber } = await import('@/lib/utils');
        const deliveryCharge = Number(businessConfig.deliveryCharge ?? 0);
        const unitPrice = Number(product.price);
        const quantity = Math.max(1, Number(orderTag.quantity) || 1);
        const subtotal = unitPrice * quantity;
        const total = subtotal + deliveryCharge;

const paymentMethodMap: Record<string, string> = {
      COD: 'COD',
      BKASH: 'BKASH',
      NAGAD: 'NAGAD',
      bkash: 'BKASH',
      nagad: 'NAGAD',
      cod: 'COD',
    };
    const paymentMethod =
      paymentMethodMap[orderTag.paymentMethod] ?? 'COD';

    // bKash/Nagad orders with a transactionId are treated as PAID
    // COD orders are always PENDING until delivery
    const paymentStatus =
      (paymentMethod === 'BKASH' || paymentMethod === 'NAGAD') &&
      orderTag.transactionId
        ? 'PAID'
        : 'PENDING';

    const order = await prisma.order.create({
      data: {
        businessId,
        orderNumber: generateOrderNumber(),
        customerName: orderTag.customerName,
        customerPhone: orderTag.customerPhone,
        deliveryAddress: orderTag.deliveryAddress,
        subtotal,
        deliveryCharge,
        total,
        paymentMethod: paymentMethod as 'COD' | 'BKASH' | 'NAGAD' | 'STRIPE',
        paymentStatus: paymentStatus as 'PENDING' | 'PAID',
        transactionId: orderTag.transactionId ?? null,
        fulfillmentStatus: 'NEW',
        channel: 'MESSENGER',
        messengerSenderId: senderId,
        statusHistory: [
          { status: 'NEW', timestamp: new Date().toISOString(), note: 'Order placed via Messenger' },
        ],
            items: {
              create: {
                productId: product.id,
                productName: product.name,
                price: unitPrice,
                quantity,
                imageUrl: (product.images as string[])[0] ?? null,
              },
            },
          },
        });

        // Link order to conversation
        await prisma.messengerConversation.update({
          where: { businessId_senderId: { businessId, senderId } },
          data: {
            associatedOrderIds: {
              push: order.id,
            },
          },
        });

        // Activity log
        await prisma.activityLog.create({
          data: {
            businessId,
            type: 'ORDER_NEW',
            title: 'New Messenger order',
            description: `Order ${order.orderNumber} from ${orderTag.customerName} via Messenger`,
            metadata: { orderId: order.id, senderId },
            actionUrl: `/dashboard/orders`,
            actionLabel: 'View Order',
          },
        });

        console.log(`[Webhook] Order ${order.orderNumber} created from Messenger conversation`);
      }
    } catch (orderErr) {
      console.error('[Webhook] Failed to create order from Messenger:', orderErr);
    }
  }

  // Send carousel only for the specific products the AI mentioned
  if (carouselSlugs && carouselSlugs.length > 0) {
    const storeUrl = `${process.env.NEXTAUTH_URL ?? 'https://socialforge3.vercel.app'}/${businessConfig.business.slug}`;

    const products = await prisma.product.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        slug: { in: carouselSlugs },
      },
    });

    // Sort by the order the AI mentioned them
    const sorted = carouselSlugs
      .map((slug) => products.find((p) => p.slug === slug))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .filter((p) => p.images && (p.images as string[]).length > 0);

    const carouselProducts = sorted.map((p) => ({
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

  // Fetch sender profile from Facebook if this is a new conversation
  let senderName: string | null = null;
  let senderAvatar: string | null = null;
  const existingConvForProfile = await prisma.messengerConversation.findUnique({
    where: { businessId_senderId: { businessId, senderId } },
    select: { senderName: true, senderAvatar: true },
  });

  if (!existingConvForProfile?.senderName) {
    const pageId = businessConfig.facebookPageId;
    const pageToken = businessConfig.facebookPageToken;
    // Strategy 1: Conversations API (requires pages_read_engagement)
    try {
      const convRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/conversations?user_id=${senderId}&fields=participants&access_token=${pageToken}`,
      );
      const convData = await convRes.json() as {
        data?: Array<{ participants?: { data?: Array<{ name: string; id: string }> } }>;
        error?: { code?: number; message?: string };
      };
      if (!convData.error) {
        const participants = convData.data?.[0]?.participants?.data ?? [];
        const userParticipant = participants.find((p) => p.id !== pageId);
        if (userParticipant?.name) {
          senderName = userParticipant.name;
          senderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userParticipant.name)}&background=7c3aed&color=fff&size=128&bold=true`;
          console.log(`[Webhook] Strategy 1 resolved name: ${senderName}`);
        }
      } else {
        console.warn(`[Webhook] Conversations API failed (${convData.error.code}): ${convData.error.message}`);
      }
    } catch (e) {
      console.error('[Webhook] Conversations API error:', e);
    }
    // Strategy 2: Direct user profile
    if (!senderName) {
      try {
        const profileRes = await fetch(
          `https://graph.facebook.com/v19.0/${senderId}?fields=name&access_token=${pageToken}`,
        );
        const profile = await profileRes.json() as { name?: string; error?: { code?: number } };
        if (!profile.error && profile.name) {
          senderName = profile.name;
          senderAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=7c3aed&color=fff&size=128&bold=true`;
          console.log(`[Webhook] Strategy 2 resolved name: ${senderName}`);
        }
      } catch (e) {
        console.error('[Webhook] Direct profile fetch error:', e);
      }
    }
    // Strategy 3: Never show "Unknown"
    if (!senderName) {
      senderName = `Messenger User`;
      senderAvatar = `https://ui-avatars.com/api/?name=M+U&background=6b7280&color=fff&size=128&bold=true`;
      console.warn(`[Webhook] Could not resolve name for ${senderId} — using fallback`);
    }
  } else {
    senderName = existingConvForProfile.senderName;
    senderAvatar = existingConvForProfile.senderAvatar;
  }

  // Upsert conversation in DB
  const conversation = await prisma.messengerConversation.upsert({
    where: { businessId_senderId: { businessId, senderId } },
    update: {
      lastMessageAt: new Date(),
      lastMessagePreview: messageText.slice(0, 100),
      unreadCount: { increment: 1 },
      // Update name/avatar if we just fetched them
      ...(senderName ? { senderName } : {}),
      ...(senderAvatar ? { senderAvatar } : {}),
    },
    create: {
      businessId,
      senderId,
      senderName,
      senderAvatar,
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

  // Save bot reply (store the clean version without the carousel tag)
  await prisma.messengerMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'BOT',
      content: visibleReply,
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