import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

const replySchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1),
});

const statusSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'FLAGGED']).optional(),
  starred: z.boolean().optional(),
  action: z.enum(['resolve', 'reopen', 'star', 'unstar', 'flag', 'unflag']).optional(),
  markRead: z.boolean().optional(),
  botPaused: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function notFound(resource = 'Resource'): NextResponse {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

function serverError(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 500 });
}

// ─────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const businessId = session.user.businessId;
  if (!businessId) return forbidden();

  const { params: segments = [] } = await params;
  const [resource, id, sub] = segments;

  // GET /api/messenger/conversations — list all conversations
  if (resource === 'conversations' && !id) {
    const conversations = await prisma.messengerConversation.findMany({
      where: { businessId },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        businessId: true,
        senderId: true,
        senderName: true,
        senderAvatar: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        unreadCount: true,
        status: true,
        starred: true,
        associatedOrderIds: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: conversations });
  }

  // GET /api/messenger/conversations/:id — single conversation with messages
  if (resource === 'conversations' && id && !sub) {
    const conversation = await prisma.messengerConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!conversation) return notFound('Conversation');
    if (conversation.businessId !== businessId) return forbidden();

    // Reset unread count when conversation is opened
    await prisma.messengerConversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });

    return NextResponse.json({ data: conversation });
  }

  // GET /api/messenger/conversations/:id/context — conversation + order summaries
  if (resource === 'conversations' && id && sub === 'context') {
    const conversation = await prisma.messengerConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!conversation) return notFound('Conversation');
    if (conversation.businessId !== businessId) return forbidden();

    // Resolve associated order IDs to summaries
    let orderSummaries: Array<{
      id: string;
      orderNumber: string;
      total: number;
      fulfillmentStatus: string;
      createdAt: Date;
    }> = [];

    if (conversation.associatedOrderIds.length > 0) {
      const orders = await prisma.order.findMany({
        where: {
          id: { in: conversation.associatedOrderIds },
          businessId,
        },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          fulfillmentStatus: true,
          createdAt: true,
        },
      });

      orderSummaries = orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        fulfillmentStatus: o.fulfillmentStatus,
        createdAt: o.createdAt,
      }));
    }

    return NextResponse.json({
      data: {
        conversation,
        orders: orderSummaries,
      },
    });
  }

  return notFound();
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const businessId = session.user.businessId;
  if (!businessId) return forbidden();

  const { params: segments = [] } = await params;
  const [action] = segments;

  // POST /api/messenger/reply — send a human reply from the dashboard
  if (action === 'reply') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const parsed = replySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const { conversationId, message } = parsed.data;

    // Fetch and verify conversation ownership
    const conversation = await prisma.messengerConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) return notFound('Conversation');
    if (conversation.businessId !== businessId) return forbidden();

    // Fetch business config for the Facebook page token
    const config = await prisma.businessConfig.findUnique({
      where: { businessId },
      select: { facebookPageToken: true },
    });

    if (!config?.facebookPageToken) {
      return NextResponse.json(
        { error: 'Facebook page token not configured. Connect your Facebook Page in Settings.' },
        { status: 422 },
      );
    }

    // Send via Facebook Send API
    let sendResponse: Response;
    try {
      sendResponse = await fetch('https://graph.facebook.com/v19.0/me/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: conversation.senderId },
          message: { text: message },
          access_token: config.facebookPageToken,
        }),
      });
    } catch (err) {
      console.error('[Messenger Reply] Network error calling Send API:', err);
      return serverError('Failed to reach Facebook Send API');
    }

    if (!sendResponse.ok) {
      const errBody = await sendResponse.json().catch(() => ({}));
      console.error('[Messenger Reply] Send API error:', errBody);
      return NextResponse.json(
        { error: 'Facebook Send API rejected the message', detail: errBody },
        { status: 502 },
      );
    }

    // Only persist the message after confirmed Send API success
    const now = new Date();
    const [newMessage] = await prisma.$transaction([
      prisma.messengerMessage.create({
        data: {
          conversationId,
          role: 'HUMAN',
          content: message,
          timestamp: now,
        },
      }),
      prisma.messengerConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          lastMessagePreview: message.length > 80 ? message.slice(0, 80) + '…' : message,
        },
      }),
    ]);

    return NextResponse.json({ data: newMessage }, { status: 201 });
  }

  return notFound();
}

// ─────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const businessId = session.user.businessId;
  if (!businessId) return forbidden();

  const { params: segments = [] } = await params;
  const [resource, id, sub] = segments;

  // PATCH /api/messenger/conversations/mark-all-read
  if (resource === 'conversations' && id === 'mark-all-read' && !sub) {
    await prisma.messengerConversation.updateMany({
      where: { businessId },
      data: { unreadCount: 0 },
    });
    return NextResponse.json({ data: { success: true } });
  }

  // PATCH /api/messenger/conversations/mark-all-read
  if (resource === 'conversations' && id === 'mark-all-read' && !sub) {
    await prisma.messengerConversation.updateMany({
      where: { businessId },
      data: { unreadCount: 0 },
    });
    return NextResponse.json({ data: { success: true } });
  }

  // PATCH /api/messenger/conversations/:id/status
  if (resource === 'conversations' && id && sub === 'status') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const { status, starred, action, markRead, botPaused } = parsed.data;

    // Verify ownership
    const existing = await prisma.messengerConversation.findUnique({
      where: { id },
      select: { businessId: true, status: true, starred: true },
    });

    if (!existing) return notFound('Conversation');
    if (existing.businessId !== businessId) return forbidden();

    const updateData: {
      status?: 'OPEN' | 'RESOLVED' | 'FLAGGED';
      starred?: boolean;
      unreadCount?: number;
      botPaused?: boolean;
    } = {};

    // Map action string to the correct field update
    if (action === 'resolve') updateData.status = 'RESOLVED';
    else if (action === 'reopen') updateData.status = 'OPEN';
    else if (action === 'flag') updateData.status = 'FLAGGED';
    else if (action === 'unflag') updateData.status = 'OPEN';
    else if (action === 'star') updateData.starred = true;
    else if (action === 'unstar') updateData.starred = false;

    // Direct field updates (non-action path)
    if (status !== undefined) updateData.status = status;
    if (starred !== undefined) updateData.starred = starred;
    if (markRead === true) updateData.unreadCount = 0;
    if (botPaused !== undefined) updateData.botPaused = botPaused;

    if (Object.keys(updateData).length === 0) {
      return badRequest('Provide at least one of: action, status, starred, markRead, botPaused');
    }

    const updated = await prisma.messengerConversation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  }

  return notFound();
}