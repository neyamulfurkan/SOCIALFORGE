'use client';

import { useEffect, useRef } from 'react';
import { useChat } from 'ai/react';
import type { Message } from 'ai/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils';
import type { StoreConfig } from '@/lib/types';
import type { ProductCard } from '@/lib/types';

// ─────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function CartPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Typing indicator
// ─────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-store-surface border border-store-border rounded-2xl rounded-tl-sm w-fit">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-store-text opacity-40"
          style={{
            animation: 'chatbot-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Product mini-card (inside chat)
// ─────────────────────────────────────────────

function ChatProductCard({
  product,
  storeSlug,
  onAddToCart,
}: {
  product: ProductCard;
  storeSlug: string;
  onAddToCart: (product: ProductCard) => void;
}) {
  return (
    <div className="shrink-0 w-40 rounded-xl border border-store-border bg-store-surface overflow-hidden flex flex-col shadow-sm">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-28 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-28 bg-store-border flex items-center justify-center">
          <span className="text-store-text opacity-30 text-xs">No image</span>
        </div>
      )}
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <p className="text-[11px] font-semibold text-store-text line-clamp-2 leading-tight">
          {product.name}
        </p>
        <p className="text-[12px] font-bold text-accent">{formatPrice(product.price)}</p>
        <div className="flex gap-1 mt-auto pt-1.5">
          <a
            href={`/${storeSlug}/products/${product.slug}`}
            className="flex-1 text-[10px] text-center py-1 rounded-md border border-store-border text-store-text hover:bg-store-border transition-colors"
          >
            View
          </a>
          <button
            onClick={() => onAddToCart(product)}
            aria-label={`Add ${product.name} to cart`}
            className="p-1.5 rounded-md bg-accent text-accent-text hover:bg-accent-hover transition-colors"
          >
            <CartPlusIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Extract products from a Message object.
//
// The Vercel AI SDK v4 attaches tool call results as `parts` on the Message.
// Each part with type === 'tool-invocation' carries:
//   { toolName, state: 'result', result: <whatever the tool returned> }
//
// We also keep a regex fallback for SDK versions that embed results in content.
// ─────────────────────────────────────────────

function getProductsFromMessage(msg: Message): ProductCard[] {
  // Primary: parse %%PRODUCTS%%[...]%%END%% marker embedded by the AI
  const markerMatch = msg.content.match(/%%PRODUCTS%%([\s\S]*?)%%END%%/);
  if (markerMatch) {
    try {
      const parsed = JSON.parse(markerMatch[1].trim());
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        typeof parsed[0].id === 'string' &&
        typeof parsed[0].name === 'string'
      ) {
        return parsed as ProductCard[];
      }
    } catch {}
  }

  // Fallback: toolInvocations (populated in some SDK versions)
  const raw = msg as unknown as {
    toolInvocations?: Array<{
      toolName: string;
      state: string;
      result?: unknown;
    }>;
  };
  if (Array.isArray(raw.toolInvocations)) {
    for (const inv of raw.toolInvocations) {
      if (
        inv.toolName === 'searchProducts' &&
        inv.state === 'result' &&
        Array.isArray(inv.result) &&
        inv.result.length > 0
      ) {
        const first = inv.result[0] as Record<string, unknown>;
        if (typeof first.id === 'string' && typeof first.name === 'string') {
          return inv.result as ProductCard[];
        }
      }
    }
  }

  return [];
}

// Strip product marker and raw tool call syntax from visible text
function cleanContent(content: string): string {
  return content
    // Remove %%PRODUCTS%%...%%END%% marker blocks
    .replace(/%%PRODUCTS%%[\s\S]*?%%END%%/g, '')
    // Remove <function=...>{...}</function> patterns
    .replace(/<function=[^>]+>[\s\S]*?<\/function>/g, '')
    // Remove embedded JSON arrays containing product objects
    .replace(/\[(\s*\{[^[\]]*"id"[^[\]]*\}[\s,]*)+\]/g, '')
    .trim();
}

// ─────────────────────────────────────────────
// Lightweight markdown renderer: **bold** + newlines
// ─────────────────────────────────────────────

function RenderText({ raw }: { raw: string }) {
  const parts = raw.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part.split('\n').map((line, j, arr) => (
          <span key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ));
      })}
    </>
  );
}

// ─────────────────────────────────────────────
// Single message bubble
// ─────────────────────────────────────────────

function MessageBubble({
  msg,
  storeSlug,
  onAddToCart,
  productsByMessageId,
}: {
  msg: Message;
  storeSlug: string;
  onAddToCart: (product: ProductCard) => void;
  productsByMessageId: React.MutableRefObject<Record<string, ProductCard[]>>;
}) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 bg-accent text-accent-text rounded-2xl rounded-tr-sm text-sm leading-relaxed">
          <RenderText raw={msg.content} />
        </div>
      </div>
    );
  }

  // Assistant message — extract products from toolInvocations
  const products = productsByMessageId.current[msg.id] ?? getProductsFromMessage(msg);
  const visibleText = cleanContent(msg.content);

  return (
    <div className="flex flex-col gap-2">
      {visibleText ? (
        <div className="max-w-[90%] px-4 py-2.5 bg-store-surface border border-store-border rounded-2xl rounded-tl-sm text-sm text-store-text leading-relaxed">
          <RenderText raw={visibleText} />
        </div>
      ) : products.length > 0 ? (
        <div className="max-w-[90%] px-4 py-2 bg-store-surface border border-store-border rounded-2xl rounded-tl-sm text-sm text-store-text leading-relaxed opacity-70">
          Here are some products for you:
        </div>
      ) : null}

      {products.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          {products.map((p) => (
            <ChatProductCard
              key={p.id}
              product={p}
              storeSlug={storeSlug}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Chatbot component
// ─────────────────────────────────────────────

export default function Chatbot({ storeConfig }: { storeConfig: StoreConfig }) {
  const chatbotOpen = useUIStore((s) => s.chatbotOpen);
  const setChatbotOpen = useUIStore((s) => s.setChatbotOpen);

  const sessionId = useRef<string>('');
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const stored = sessionStorage.getItem('chatbot-session');
    if (stored) {
      sessionId.current = stored;
    } else {
      const id = Math.random().toString(36).slice(2);
      sessionStorage.setItem('chatbot-session', id);
      sessionId.current = id;
    }
  }, []);

  // Store products keyed by assistant message id
  const productsByMessageId = useRef<Record<string, ProductCard[]>>({});

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: '/api/ai/chat',
      body: {
        businessId: storeConfig.id,
        storeSlug: storeConfig.slug,
        get sessionId() { return sessionId.current; },
      },
      initialMessages: storeConfig.config.chatbotWelcomeMessage
        ? [{ id: 'welcome', role: 'assistant' as const, content: storeConfig.config.chatbotWelcomeMessage }]
        : [],
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (chatbotOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [chatbotOpen]);

  function handleAddToCart(product: ProductCard) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useCartStore } = require('@/store/cartStore');
      useCartStore.getState().addItem({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: 1,
        imageUrl: product.imageUrl,
        slug: product.slug,
      });
      useUIStore.getState().addToast({
        variant: 'success',
        message: `${product.name} added to cart`,
        duration: 3000,
      });
    } catch {
      // store not available
    }
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSubmit(e);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      e.currentTarget.closest('form')?.requestSubmit();
    }
  }

  return (
    <AnimatePresence>
      {chatbotOpen && (
        <>
          <motion.div
            key="chatbot-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setChatbotOpen(false)}
          />

          <motion.div
            key="chatbot-panel"
            initial={{ scale: 0.97, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'fixed z-50 flex flex-col bg-store-bg shadow-elevated overflow-hidden',
              'bottom-0 left-0 right-0 rounded-t-2xl h-[75vh]',
              'md:bottom-24 md:right-4 md:left-auto md:w-96 md:rounded-2xl md:h-[600px]',
              '[&]:min-h-0',
            )}
            style={{ maxHeight: '75vh' }}
          >
            <style>{`
              @keyframes chatbot-bounce {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                30% { transform: translateY(-6px); opacity: 1; }
              }
              .scrollbar-hide::-webkit-scrollbar { display: none; }
              .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div data-chatbot-panel className="flex flex-col h-full min-h-0 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-store-border bg-store-surface flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent">
                    <SparkleIcon className="w-4 h-4 text-accent-text" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-store-text leading-tight">{storeConfig.name}</p>
                    <p className="text-[11px] text-store-text opacity-50 leading-tight">Ask me anything</p>
                  </div>
                </div>
                <button
                  onClick={() => setChatbotOpen(false)}
                  aria-label="Close chat"
                  className="p-1.5 rounded-md text-store-text opacity-50 hover:opacity-100 hover:bg-store-border transition-all"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0 overscroll-contain" style={{ minHeight: 0 }}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    storeSlug={storeConfig.slug}
                    onAddToCart={handleAddToCart}
                    productsByMessageId={productsByMessageId}
                  />
                ))}
                {isLoading && (
                  <div className="flex justify-start"><TypingIndicator /></div>
                )}
                {error && (
                  <div className="flex justify-start">
                    <div className="max-w-[90%] px-4 py-2.5 bg-store-surface border border-store-border rounded-2xl rounded-tl-sm text-sm text-store-text opacity-70">
                      Sorry, something went wrong. Please try again.
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={onSend}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-store-border bg-store-surface"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={onKeyDown}
                  placeholder="Type a message…"
                  aria-label="Chat message"
                  className={cn(
                    'flex-1 bg-store-bg border border-store-border rounded-xl px-3 py-2',
                    'text-sm text-store-text placeholder:text-store-text placeholder:opacity-40',
                    'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all',
                  )}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    'bg-accent text-accent-text hover:bg-accent-hover transition-all',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <SendIcon className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}