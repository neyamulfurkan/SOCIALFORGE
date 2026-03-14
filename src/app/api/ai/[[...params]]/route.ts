import { NextRequest, NextResponse } from 'next/server';
import { streamText, generateText, tool } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { redis, rateLimit } from '@/lib/redis';
import { RATE_LIMITS, AI_MODELS, CACHE_TTL, CHATBOT_PERSONALITIES } from '@/lib/constants';
import { getGroqKey } from '@/lib/platform-config';
import { auth } from '@/lib/auth';
import type { BusinessConfigShape } from '@/lib/types';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

function buildChatSystemPrompt(
  storeName: string,
  config: Pick<
    BusinessConfigShape,
    | 'chatbotPersonality'
    | 'chatbotWelcomeMessage'
    | 'chatbotLanguage'
    | 'knowledgeBase'
    | 'deliveryCharge'
    | 'freeDeliveryThreshold'
    | 'deliveryTimeMessage'
    | 'bkashNumber'
    | 'nagadNumber'
    | 'cashOnDelivery'
  >,
): string {
  const personality =
    CHATBOT_PERSONALITIES.find((p) => p.id === config.chatbotPersonality) ??
    CHATBOT_PERSONALITIES[0];

  const knowledgeBaseText =
    config.knowledgeBase.length > 0
      ? config.knowledgeBase
          .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
          .join('\n\n')
      : 'No specific FAQ entries configured.';

  const deliveryInfo = [
    config.deliveryCharge > 0
      ? `Delivery charge: ৳${config.deliveryCharge}`
      : 'Delivery charge: Free',
    config.freeDeliveryThreshold
      ? `Free delivery on orders over ৳${config.freeDeliveryThreshold}`
      : null,
    config.deliveryTimeMessage ? `Delivery time: ${config.deliveryTimeMessage}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  const paymentMethods = [
    config.bkashNumber ? `bKash (${config.bkashNumber})` : null,
    config.nagadNumber ? `Nagad (${config.nagadNumber})` : null,
    config.cashOnDelivery ? 'Cash on Delivery' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const languageInstruction =
    config.chatbotLanguage === 'bn'
      ? 'Always respond in Bengali (Bangla). Use Bengali script.'
      : config.chatbotLanguage === 'mixed'
        ? 'Respond in a mix of Bengali and English as is natural for the customer.'
        : 'Respond in English.';

  return `You are the AI assistant for ${storeName}, an online store. ${personality.systemPromptHint}

${languageInstruction}

STORE INFORMATION:
- Store name: ${storeName}
- Payment methods accepted: ${paymentMethods || 'Cash on Delivery'}
- ${deliveryInfo}

KNOWLEDGE BASE (use these to answer customer questions):
${knowledgeBaseText}

CAPABILITIES:
- You can search for products using the searchProducts tool when customers ask about specific items.
- You can help customers place orders by collecting: product name/ID, quantity, delivery address, phone number, and payment preference.
- When you cannot answer a question, politely offer to forward it to the store team rather than leaving the customer without help.

CRITICAL RULES — FOLLOW THESE EXACTLY:
- NEVER describe or list products from memory. You do not know the product catalog.
- ALWAYS call the searchProducts tool before mentioning any product, price, or item.
- When a customer asks to see products, show products, best sellers, highest priced, cheapest, or any specific item — call searchProducts IMMEDIATELY.
- After calling searchProducts, you MUST embed the results in your reply using EXACTLY this format on its own line:
  %%PRODUCTS%%[{"id":"...","name":"...","price":0,"imageUrl":"...","slug":"..."}]%%END%%
- After the %%PRODUCTS%%...%%END%% block, write exactly 1 short sentence like "Here are some products, take a look!"
- Keep all other text responses to 1-2 sentences maximum.
- Do not discuss competitors or make negative comparisons.
- NEVER output raw function call syntax. Always use the tool properly.`;
}

function buildOnboardingSystemPrompt(): string {
  return `You are a friendly onboarding assistant helping a new business owner set up their online store on SocialForge.

Guide them through setup one question at a time in a conversational, encouraging tone. Collect:
1. Their store name
2. Product categories they sell
3. Brand personality (friendly, professional, playful, or minimal)
4. Preferred chatbot language (English, Bengali, or mixed)
5. Delivery policy (in their own words)
6. Payment methods (bKash number, Nagad number, Cash on Delivery toggle)
7. Facebook Page connection (offer to skip for later)

After collecting all information, provide a warm summary of what has been configured.

Keep each message short (2-3 sentences max). Ask one thing at a time. Be encouraging and positive.`;
}

// ─────────────────────────────────────────────
// ROUTE PARAMS
// ─────────────────────────────────────────────

type RouteContext = {
  params: Promise<{ params?: string[] }>;
};

// ─────────────────────────────────────────────
// POST — chat, description, reply-suggest
// ─────────────────────────────────────────────

export async function POST(req: NextRequest, context: RouteContext): Promise<Response> {
  const { params: paramSegments } = await context.params;
  const action = paramSegments?.[0];
  const ip = getClientIp(req);

  // ── CHAT (streaming chatbot) ──────────────────
  if (action === 'chat') {
    const { success } = await rateLimit(
      `rl:chatbot:${ip}`,
      RATE_LIMITS.CHATBOT.limit,
      RATE_LIMITS.CHATBOT.window,
    );
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 },
      );
    }

    let body: {
      messages: Array<{ role: string; content: string }>;
      businessId: string;
      storeSlug: string;
      sessionId?: string;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { messages, businessId, storeSlug, sessionId } = body;

    if (!businessId || !storeSlug || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing required fields: businessId, storeSlug, messages.' },
        { status: 400 },
      );
    }

    let groqKey: string;
    try {
      // Try business-specific key first, then fall back to global
      groqKey = await getGroqKey('CHATBOT', businessId);
    } catch {
      // If business key not found, try global key with no businessId
      try {
        groqKey = await getGroqKey('CHATBOT');
      } catch {
        return NextResponse.json(
          { error: 'Chatbot is not configured yet. Please contact the store.' },
          { status: 503 },
        );
      }
    }

    // Fetch business + config
    const business = await prisma.business.findFirst({
      where: {
        OR: [{ id: businessId }, { slug: storeSlug }],
        status: 'ACTIVE',
      },
      include: { config: true },
    });

    if (!business || !business.config) {
      return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
    }

    const config = business.config;

    // Load session context from Redis
    let sessionContext: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (sessionId) {
      try {
        const redisKey = `chatbot:${storeSlug}:${sessionId}`;
        const stored = await redis.get<Array<{ role: 'user' | 'assistant'; content: string }>>(
          redisKey,
        );
        if (stored) sessionContext = stored;
      } catch {}
    }

    const systemPrompt = buildChatSystemPrompt(business.name, {
      chatbotPersonality: config.chatbotPersonality,
      chatbotWelcomeMessage: config.chatbotWelcomeMessage,
      chatbotLanguage: config.chatbotLanguage,
      knowledgeBase: (config.knowledgeBase as Array<{ question: string; answer: string }>) ?? [],
      deliveryCharge: Number(config.deliveryCharge),
      freeDeliveryThreshold: config.freeDeliveryThreshold
        ? Number(config.freeDeliveryThreshold)
        : null,
      deliveryTimeMessage: config.deliveryTimeMessage,
      bkashNumber: config.bkashNumber,
      nagadNumber: config.nagadNumber,
      cashOnDelivery: config.cashOnDelivery,
    });

    const groq = createGroq({ apiKey: groqKey });

    // Merge session context with incoming messages (deduplicate)
    const allMessages = messages as Array<{ role: 'user' | 'assistant'; content: string }>;

    try {
      const result = streamText({
        model: groq(AI_MODELS.CHAT),
        system: systemPrompt,
        messages: allMessages,
        maxSteps: 5,
        toolChoice: 'auto',
        experimental_toolCallStreaming: false,
        tools: {
          searchProducts: tool({
            description: 'Search for products in this store by name or keyword.',
            parameters: z.object({
              query: z.string().describe('The search term to find products'),
            }),
            execute: async ({ query }) => {
              const products = await prisma.product.findMany({
                where: {
                  businessId: business.id,
                  status: 'ACTIVE',
                  ...(query && query.length > 0 ? {
                    OR: [
                      { name: { contains: query, mode: 'insensitive' } },
                      { description: { contains: query, mode: 'insensitive' } },
                      { category: { contains: query, mode: 'insensitive' } },
                    ],
                  } : {}),
                },
                take: 5,
                orderBy: { price: 'desc' },
                select: {
                  id: true,
                  name: true,
                  price: true,
                  images: true,
                  slug: true,
                },
              });
              return products.map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                imageUrl: p.images[0] ?? '',
                slug: p.slug,
              }));
            },
          }),
        },
        onFinish: async ({ text }) => {
          if (!sessionId) return;
          try {
            const redisKey = `chatbot:${storeSlug}:${sessionId}`;
            const updatedSession = [
              ...sessionContext,
              ...allMessages.slice(sessionContext.length),
              { role: 'assistant' as const, content: text },
            ].slice(-20);
            await redis.setex(redisKey, CACHE_TTL.MESSENGER_SESSION, JSON.stringify(updatedSession));
          } catch {}
        },
      });

      return result.toDataStreamResponse();
    } catch (err) {
      console.error('[AI/chat] streamText error:', err);
      const message = err instanceof Error ? err.message : 'AI service error';
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  // ── DESCRIPTION (product description generation) ──
  if (action === 'description') {
    const session = await auth();
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { success } = await rateLimit(
      `rl:ai:${ip}`,
      RATE_LIMITS.AI.limit,
      RATE_LIMITS.AI.window,
    );
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    let body: { productName: string; category: string; businessId: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { productName, category, businessId } = body;

    if (!productName || !category || !businessId) {
      return NextResponse.json(
        { error: 'Missing required fields: productName, category, businessId.' },
        { status: 400 },
      );
    }

    if (session.user.businessId !== businessId && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    let groqKey: string;
    try {
      groqKey = await getGroqKey('DESCRIPTIONS', businessId);
    } catch {
      return NextResponse.json(
        { error: 'Description generation is not configured. Please contact the admin.' },
        { status: 503 },
      );
    }

    const groq = createGroq({ apiKey: groqKey });

    try {
      const { text } = await generateText({
        model: groq(AI_MODELS.DESCRIPTION),
        prompt: `Write a compelling product description for the following item. Keep it 2–4 sentences. 
Be specific, highlight benefits, and match the tone appropriate for the category.

Product name: ${productName}
Category: ${category}

Output only the description text. No headings, no bullet points, no extra commentary.`,
      });

      return NextResponse.json({ data: { description: text.trim() } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI service error';
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  // ── REPLY-SUGGEST (Messenger reply suggestion) ──
  if (action === 'reply-suggest') {
    const session = await auth();
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { success } = await rateLimit(
      `rl:ai:${ip}`,
      RATE_LIMITS.AI.limit,
      RATE_LIMITS.AI.window,
    );
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    let body: { conversationId: string; businessId: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { conversationId, businessId } = body;

    if (!conversationId || !businessId) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, businessId.' },
        { status: 400 },
      );
    }

    if (session.user.businessId !== businessId && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const conversation = await prisma.messengerConversation.findFirst({
      where: { id: conversationId, businessId },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    let groqKey: string;
    try {
      groqKey = await getGroqKey('CHATBOT', businessId);
    } catch {
      return NextResponse.json(
        { error: 'Reply suggestion is not configured. Please contact the admin.' },
        { status: 503 },
      );
    }

    const groq = createGroq({ apiKey: groqKey });

    const messageHistory = conversation.messages
      .reverse()
      .map((m) => `${m.role === 'CUSTOMER' ? 'Customer' : 'Agent'}: ${m.content}`)
      .join('\n');

    try {
      const { text } = await generateText({
        model: groq(AI_MODELS.CHAT),
        prompt: `You are assisting a business owner in responding to a customer message on Facebook Messenger.
Based on the conversation history below, suggest a helpful, natural reply that the business owner can send.
Keep it concise (1-3 sentences). Output only the suggested reply text.

Conversation:
${messageHistory}

Suggested reply:`,
      });

      return NextResponse.json({ data: { reply: text.trim() } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI service error';
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  return NextResponse.json({ error: 'Not found.' }, { status: 404 });
}

// ─────────────────────────────────────────────
// GET — onboarding streaming assistant
// ─────────────────────────────────────────────

export async function GET(req: NextRequest, context: RouteContext): Promise<Response> {
  const { params: paramSegments } = await context.params;
  const action = paramSegments?.[0];
  const ip = getClientIp(req);

  if (action === 'onboarding') {
    const { success } = await rateLimit(
      `rl:chatbot:${ip}`,
      RATE_LIMITS.CHATBOT.limit,
      RATE_LIMITS.CHATBOT.window,
    );
    if (!success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const message = searchParams.get('message') ?? 'Hello, I want to set up my store.';

    let groqKey: string;
    try {
      // Onboarding uses the global chatbot key (no businessId yet)
      groqKey = await getGroqKey('CHATBOT');
    } catch {
      return NextResponse.json(
        { error: 'Onboarding assistant is not configured. Please contact the platform admin.' },
        { status: 503 },
      );
    }

    const groq = createGroq({ apiKey: groqKey });

    try {
      const result = streamText({
        model: groq(AI_MODELS.CHAT),
        system: buildOnboardingSystemPrompt(),
        messages: [{ role: 'user', content: message }],
      });

      return result.toDataStreamResponse();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI service error';
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  return NextResponse.json({ error: 'Not found.' }, { status: 404 });
}