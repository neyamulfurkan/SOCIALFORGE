import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { CACHE_TTL, AI_MODELS } from '@/lib/constants';
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
  // Constant-time comparison to prevent timing attacks
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

async function processMessagingEvent(
  event: MessagingEvent,
  pageId: string,
): Promise<void> {
  // Skip echoes, delivery receipts, and read receipts
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

  const businessId = businessConfig.businessId;

  // Load conversation session from Redis
  const sessionKey = `messenger:${businessId}:${senderId}`;
  const sessionData: MessengerSession =
    (await redis.get<MessengerSession>(sessionKey)) ?? { messages: [] };

  // Build context for AI — keep last 20 messages to avoid token overflow
  const historyWindow = sessionData.messages.slice(-20);
  historyWindow.push({ role: 'user', content: messageText });

  // Build system prompt from business config
  const knowledgeBase = businessConfig.knowledgeBase as Array<{
    question: string;
    answer: string;
  }> | null;

  const kbSection =
    knowledgeBase && knowledgeBase.length > 0
      ? '\n\nKnowledge base:\n' +
        knowledgeBase
          .map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`)
          .join('\n\n')
      : '';

  const systemPrompt =
    `You are a helpful assistant for ${businessConfig.business.name}. ` +
    `Personality: ${businessConfig.chatbotPersonality}. ` +
    `Reply in language: ${businessConfig.chatbotLanguage}. ` +
    `Keep replies concise and helpful for a Messenger conversation.` +
    kbSection;

  // Fetch the Groq key and generate a reply
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

  // Send the reply via Facebook Send API
  await sendMessengerMessage(senderId, reply, businessConfig.facebookPageToken);

  // Update session in Redis
  const updatedMessages = [
    ...historyWindow,
    { role: 'assistant', content: reply },
  ];
  await redis.setex(
    sessionKey,
    CACHE_TTL.MESSENGER_SESSION,
    JSON.stringify({ messages: updatedMessages }),
  );

  // Upsert conversation record in DB
  const conversation = await prisma.messengerConversation.upsert({
    where: { businessId_senderId: { businessId, senderId } },
    update: {
      lastMessageAt: new Date(),
      lastMessagePreview: reply.slice(0, 100),
      unreadCount: { increment: 1 },
    },
    create: {
      businessId,
      senderId,
      lastMessageAt: new Date(),
      lastMessagePreview: reply.slice(0, 100),
      status: 'OPEN',
      unreadCount: 1,
    },
  });

  // Persist the incoming customer message
  await prisma.messengerMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'CUSTOMER',
      content: messageText,
      timestamp: new Date(),
      mid: messageMid,
    },
  });

  // Persist the bot reply
  await prisma.messengerMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'BOT',
      content: reply,
      timestamp: new Date(),
    },
  });

  // Write activity log
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
  // 1. Read raw body for signature verification
  const rawBody = await req.text();

  // 2. Verify HMAC-SHA256 signature before anything else
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  // 3. Return 200 immediately — Meta requires a response within 5 seconds
  //    All processing happens asynchronously after the response is returned.
  void (async () => {
    try {
      const body = JSON.parse(rawBody) as WebhookBody;

      // Only process page messages
      if (body.object !== 'page') return;

      const entries = body.entry ?? [];

      for (const entry of entries) {
        const pageId = entry.id;
        const messagingEvents = entry.messaging ?? [];

        for (const event of messagingEvents) {
          try {
            await processMessagingEvent(event, pageId);
          } catch (eventErr) {
            // Log per-event errors but continue processing other events
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
  })();

  return NextResponse.json({ status: 'ok' });
}