'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import { formatRelativeTime, truncate } from '@/lib/utils';
import type { ConversationWithMessages } from '@/lib/types';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type MessengerMessage = {
  id: string;
  conversationId: string;
  role: 'CUSTOMER' | 'BOT' | 'HUMAN';
  content: string;
  timestamp: string | Date;
  mid: string | null;
};

type ConversationDetail = ConversationWithMessages & {
  messages: MessengerMessage[];
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function renderMessageContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={li}>
        {parts.map((part, pi) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pi}>{part.slice(2, -2)}</strong>;
          }
          return <span key={pi}>{part}</span>;
        })}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

function InitialsAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const dims = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${dims} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          // Fallback to initials if image fails
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={`${dims} rounded-full bg-accent/20 text-accent font-semibold flex items-center justify-center flex-shrink-0`}
    >
      {initials || '?'}
    </div>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-accent-text text-xs font-semibold">
      {count > 9 ? '9+' : count}
    </span>
  );
}

// Status icon SVGs
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 2l1.8 3.6L14 6.4l-3 2.9.7 4.1L8 11.3l-3.7 2.1.7-4.1-3-2.9 4.2-.8z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill={filled ? 'currentColor' : 'none'}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlagIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 2v12M3 2h9l-2.5 4L12 10H3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2L2 7l5 1.5L8.5 14 14 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4.2 4.2l2.1 2.1M9.7 9.7l2.1 2.1M4.2 11.8l2.1-2.1M9.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3H3v10h10v-3M9 3h4v4M13 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

type MessagesInboxProps = {
  initialConversations: ConversationWithMessages[];
  businessId: string;
};

export default function MessagesInbox({ initialConversations, businessId }: MessagesInboxProps) {
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  // ── Conversations list query ──
  const { data: conversations = [] } = useQuery<ConversationWithMessages[]>({
    queryKey: ['conversations', businessId],
    queryFn: async () => {
      const res = await fetch('/api/messenger/conversations', { credentials: 'include' });
      const json = await res.json();
      return json.data ?? [];
    },
    initialData: initialConversations,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // ── Selected conversation messages query ──
  const { data: threadData } = useQuery<ConversationDetail | null>({
    queryKey: ['conversation-messages', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await fetch(`/api/messenger/conversations/${selectedId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data ?? null;
    },
    enabled: !!selectedId,
    staleTime: 10_000,
  });

  // ── Auto-scroll to bottom when new messages arrive ──
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threadData?.messages?.length]);

  // ── Mark conversation as read when selected ──
  const markReadMutation = useMutation({
    mutationFn: async (convId: string) => {
      await fetch(`/api/messenger/conversations/${convId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markRead: true }),
        // markRead:true is handled by the route's statusSchema
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', businessId] });
    },
  });

  const handleSelectConversation = useCallback(
    (convId: string) => {
      setSelectedId(convId);
      setReplyText('');
      setMobileShowThread(true);
      const conv = conversations.find((c) => c.id === convId);
      if (conv && conv.unreadCount > 0) {
        markReadMutation.mutate(convId);
      }
    },
    [conversations, markReadMutation],
  );

  // ── Conversation status mutations ──
  const statusMutation = useMutation({
    mutationFn: async ({ convId, action }: { convId: string; action: string }) => {
      const res = await fetch(`/api/messenger/conversations/${convId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Status update failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', businessId] });
      if (selectedId) {
        qc.invalidateQueries({ queryKey: ['conversation-messages', selectedId] });
      }
    },
  });

  // ── Mark all as read ──
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/messenger/conversations/mark-all-read', {
        method: 'PATCH',
        credentials: 'include',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', businessId] });
    },
  });

  // ── Send reply ──
  const handleSendReply = useCallback(async () => {
    if (!selectedId || !replyText.trim() || isSendingReply) return;
    setIsSendingReply(true);
    try {
      const res = await fetch('/api/messenger/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conversationId: selectedId, message: replyText.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error('Send reply failed:', json.error ?? res.statusText);
        return; // Do not clear input on failure
      }
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['conversation-messages', selectedId] });
      qc.invalidateQueries({ queryKey: ['conversations', businessId] });
    } catch (err) {
      console.error('Send reply error:', err);
    } finally {
      setIsSendingReply(false);
    }
  }, [selectedId, replyText, isSendingReply, qc, businessId]);

  // ── AI reply suggestion ──
  const handleAISuggest = useCallback(async () => {
    if (!selectedId || isSuggesting) return;
    setIsSuggesting(true);
    try {
      const res = await fetch('/api/ai/reply-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conversationId: selectedId, businessId }),
      });
      if (!res.ok) throw new Error('AI suggest failed');
      const json = await res.json();
      if (json.reply) {
        setReplyText(json.reply);
      }
    } catch (err) {
      console.error('AI suggest error:', err);
    } finally {
      setIsSuggesting(false);
    }
  }, [selectedId, isSuggesting, businessId]);

  // ── Keyboard send ──
  const handleReplyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendReply();
      }
    },
    [handleSendReply],
  );

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const messages: MessengerMessage[] = (threadData?.messages ?? []) as MessengerMessage[];
  const associatedOrderIds: string[] = threadData?.associatedOrderIds ?? selectedConv?.associatedOrderIds ?? [];

  // ─────────────────────────────────────────────
  // EMPTY STATE
  // ─────────────────────────────────────────────

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center">
          <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8 text-text-secondary" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 8a4 4 0 014-4h16a4 4 0 014 4v12a4 4 0 01-4 4H10l-6 4V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-text-primary font-semibold text-lg">No Messenger conversations yet</p>
        <p className="text-text-secondary text-sm max-w-xs">
          Connect your Facebook Page in{' '}
          <a href="/dashboard/settings" className="text-accent hover:underline">
            Settings
          </a>{' '}
          to start receiving messages.
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden min-h-0">
      {/* ── Left column: conversation list ── */}
      <div
        className={`
          w-full md:w-72 border-r border-border flex flex-col flex-shrink-0 bg-base min-h-0
          ${mobileShowThread ? 'hidden md:flex' : 'flex'}
        `}
      >
        {/* List header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Messages</h2>
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            title="Mark all as read"
          >
            Mark all read
          </button>
        </div>

        {/* Conversation items */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            const name = conv.senderName ?? 'Unknown';
            return (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`
                  w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border transition-colors
                  ${isSelected ? 'bg-surface-raised' : 'hover:bg-surface'}
                `}
              >
                <InitialsAvatar name={name} avatarUrl={conv.senderAvatar} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">{name}</span>
                    <span className="text-xs text-text-tertiary flex-shrink-0">
                      {formatRelativeTime(new Date(conv.lastMessageAt))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-text-secondary truncate">
                      {truncate(conv.lastMessagePreview, 50)}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <UnreadBadge count={conv.unreadCount} />
                      {conv.status === 'RESOLVED' && (
                        <CheckIcon className="w-3.5 h-3.5 text-success" />
                      )}
                      {conv.starred && (
                        <StarIcon className="w-3.5 h-3.5 text-warning" filled />
                      )}
                      {conv.status === 'FLAGGED' && (
                        <FlagIcon className="w-3.5 h-3.5 text-error" filled />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right column: thread ── */}
      <div
        className={`
          flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-base
          ${mobileShowThread ? 'flex' : 'hidden md:flex'}
        `}
      >
        {!selectedId || !selectedConv ? (
          /* No conversation selected */
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-text-secondary">
                <path d="M3 6a3 3 0 013-3h12a3 3 0 013 3v9a3 3 0 01-3 3H7l-4 3V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm">Select a conversation to start</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
              {/* Mobile back button */}
              <button
                onClick={() => {
                  setMobileShowThread(false);
                  setSelectedId(null);
                }}
                className="md:hidden p-1 text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Back to conversations"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>

              <InitialsAvatar name={selectedConv.senderName ?? 'Unknown'} avatarUrl={selectedConv.senderAvatar} size="sm" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {selectedConv.senderName ?? 'Unknown'}
                  </span>
                  <a
                    href={`https://www.facebook.com/${selectedConv.senderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-tertiary hover:text-text-secondary transition-colors"
                    title="View on Facebook"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Status action buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    statusMutation.mutate({
                      convId: selectedConv.id,
                      action: selectedConv.status === 'RESOLVED' ? 'reopen' : 'resolve',
                    })
                  }
                  title={selectedConv.status === 'RESOLVED' ? 'Reopen' : 'Resolve'}
                  className={`p-1.5 rounded-md transition-colors ${
                    selectedConv.status === 'RESOLVED'
                      ? 'text-success bg-success/10'
                      : 'text-text-secondary hover:text-success hover:bg-success/10'
                  }`}
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    statusMutation.mutate({
                      convId: selectedConv.id,
                      action: selectedConv.starred ? 'unstar' : 'star',
                    })
                  }
                  title={selectedConv.starred ? 'Unstar' : 'Star'}
                  className={`p-1.5 rounded-md transition-colors ${
                    selectedConv.starred
                      ? 'text-warning bg-warning/10'
                      : 'text-text-secondary hover:text-warning hover:bg-warning/10'
                  }`}
                >
                  <StarIcon className="w-4 h-4" filled={selectedConv.starred} />
                </button>
                <button
                  onClick={() =>
                    statusMutation.mutate({
                      convId: selectedConv.id,
                      action: selectedConv.status === 'FLAGGED' ? 'unflag' : 'flag',
                    })
                  }
                  title={selectedConv.status === 'FLAGGED' ? 'Unflag' : 'Flag'}
                  className={`p-1.5 rounded-md transition-colors ${
                    selectedConv.status === 'FLAGGED'
                      ? 'text-error bg-error/10'
                      : 'text-text-secondary hover:text-error hover:bg-error/10'
                  }`}
                >
                  <FlagIcon className="w-4 h-4" filled={selectedConv.status === 'FLAGGED'} />
                </button>
              </div>
            </div>

            {/* Context banner */}
            {associatedOrderIds.length > 0 && (
              <div className="px-4 py-2 bg-surface border-b border-border flex items-center gap-2 flex-wrap flex-shrink-0">
                <span className="text-xs text-text-secondary">Orders:</span>
                {associatedOrderIds.map((orderId) => (
                  <a
                    key={orderId}
                    href={`/dashboard/orders?orderId=${orderId}`}
                    className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full hover:bg-accent/20 transition-colors"
                  >
                    #{orderId.slice(-8).toUpperCase()}
                  </a>
                ))}
              </div>
            )}

            {/* Bot status banner with toggle */}
            {(() => {
              const conv = threadData ?? selectedConv;
              const botPaused = (conv as { botPaused?: boolean })?.botPaused ?? false;
              return (
                <div className="px-4 py-1.5 bg-surface border-b border-border flex items-center justify-between gap-2 flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className={`w-1.5 h-1.5 rounded-full inline-block ${
                        botPaused ? 'bg-warning' : 'bg-success'
                      }`}
                    />
                    <span className="text-text-secondary">
                      {botPaused ? 'Bot paused — you are handling this' : 'Bot is handling this conversation'}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      if (!selectedId) return;
                      fetch(`/api/messenger/conversations/${selectedId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ botPaused: !botPaused }),
                      }).then(() => {
                        qc.invalidateQueries({ queryKey: ['conversations', businessId] });
                        qc.invalidateQueries({ queryKey: ['conversation-messages', selectedId] });
                      });
                    }}
                    className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${
                      botPaused
                        ? 'border-success text-success hover:bg-success/10'
                        : 'border-warning text-warning hover:bg-warning/10'
                    }`}
                  >
                    {botPaused ? 'Resume bot' : 'Pause bot'}
                  </button>
                </div>
              );
            })()}

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              {messages.length === 0 && (
                <p className="text-center text-text-tertiary text-sm py-8">No messages yet</p>
              )}
              {messages.map((msg) => {
                const isCustomer = msg.role === 'CUSTOMER';
                const isHuman = msg.role === 'HUMAN';
                const isBot = msg.role === 'BOT';

                if (isCustomer) {
                  return (
                    <div key={msg.id} className="flex items-end gap-2">
                      <InitialsAvatar name={selectedConv.senderName ?? 'C'} size="sm" />
                      <div className="max-w-xs lg:max-w-md">
                        <div className="bg-store-border text-store-text rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                          {renderMessageContent(msg.content)}
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                          {formatRelativeTime(new Date(msg.timestamp))}
                        </p>
                      </div>
                    </div>
                  );
                }

                if (isBot) {
                  return (
                    <div key={msg.id} className="flex items-end gap-2">
                      <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0">
                        <SparkleIcon className="w-4 h-4 text-accent" />
                      </div>
                      <div className="max-w-xs lg:max-w-md">
                        <p className="text-xs text-text-tertiary mb-1">Bot</p>
                        <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-text-primary">
                          {renderMessageContent(msg.content)}
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                          {formatRelativeTime(new Date(msg.timestamp))}
                        </p>
                      </div>
                    </div>
                  );
                }

                if (isHuman) {
                  return (
                    <div key={msg.id} className="flex items-end justify-end gap-2">
                      <div className="max-w-xs lg:max-w-md">
                        <div className="bg-accent text-accent-text rounded-2xl rounded-br-sm px-3 py-2 text-sm">
                          {renderMessageContent(msg.content)}
                        </div>
                        <p className="text-xs text-text-tertiary mt-1 text-right">
                          {formatRelativeTime(new Date(msg.timestamp))}
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply bar */}
            <div className="border-t border-border px-4 py-3 flex-shrink-0 bg-base">
              <div className="flex items-end gap-2">
                {/* AI Assist button */}
                <button
                  onClick={handleAISuggest}
                  disabled={isSuggesting}
                  title="AI Assist — generate reply suggestion"
                  className="flex-shrink-0 p-2 rounded-md border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSuggesting ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <SparkleIcon className="w-4 h-4" />
                  )}
                </button>

                {/* Text input */}
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  className="
                    flex-1 bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary
                    placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
                    resize-none transition-colors min-h-[38px] max-h-32 overflow-y-auto
                  "
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />

                {/* Send button */}
                <Button
                  onClick={handleSendReply}
                  loading={isSendingReply}
                  disabled={!replyText.trim()}
                  size="sm"
                  className="flex-shrink-0 gap-1.5"
                >
                  <SendIcon className="w-3.5 h-3.5" />
                  Send
                </Button>
              </div>
              <p className="text-xs text-text-tertiary mt-1.5 ml-12">
                This reply will be sent as your page via Facebook Messenger
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}