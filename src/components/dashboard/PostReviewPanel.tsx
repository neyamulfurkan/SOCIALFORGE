'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SocialPost } from '@prisma/client';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { IMAGE_TRANSFORMS } from '@/lib/constants';

// ─────────────────────────────────────────────
// INLINE DRAWER STUB
// Replace with: import Drawer from '@/components/ui/Drawer'
// when FILE 074 is generated. Drawer MUST accept:
// { open, onClose, title, children, footer?, width? }
// ─────────────────────────────────────────────

type DrawerStubProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
};

function DrawerStub({ open, onClose, title, children, footer, width = 640 }: DrawerStubProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-full bg-surface flex flex-col shadow-elevated"
        style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100vw' : width }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// INLINE TOAST STUB
// Replace with: import { toast } from '@/components/ui/Toast'
// when FILE 073 is generated. toast MUST expose:
// toast.success(msg), toast.error(msg), toast.warning(msg), toast.info(msg)
// ─────────────────────────────────────────────

const toast = {
  success: (msg: string) => console.info('[toast:success]', msg),
  error: (msg: string) => console.error('[toast:error]', msg),
  warning: (msg: string) => console.warn('[toast:warning]', msg),
  info: (msg: string) => console.info('[toast:info]', msg),
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type ImageUrls = {
  facebook: string[];
  instagram: string[];
};

type PostData = SocialPost & {
  imageUrls: ImageUrls;
};

type ToneLabel = 'professional' | 'neutral' | 'playful';
type LengthLabel = 'short' | 'medium' | 'long';

const TONE_LABELS: ToneLabel[] = ['professional', 'neutral', 'playful'];
const LENGTH_LABELS: LengthLabel[] = ['short', 'medium', 'long'];

function toneToLabel(tone: number): ToneLabel {
  if (tone < 34) return 'professional';
  if (tone < 67) return 'neutral';
  return 'playful';
}

// ─────────────────────────────────────────────
// MOCK FACEBOOK PREVIEW
// ─────────────────────────────────────────────

function FacebookPreview({
  caption,
  imageUrl,
  onCaptionChange,
  disabled,
}: {
  caption: string;
  imageUrl: string | null;
  onCaptionChange: (val: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border border-store-border bg-white overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-accent"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Your Store</p>
          <p className="text-xs text-gray-500">Just now · 🌐</p>
        </div>
      </div>

      {/* Image */}
      {imageUrl ? (
        <div className="w-full" style={{ aspectRatio: '16/9', background: '#f0f0f0' }}>
          <img
            src={imageUrl}
            alt="Post preview"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full bg-surface-raised flex items-center justify-center text-text-tertiary text-sm" style={{ aspectRatio: '16/9' }}>
          No image
        </div>
      )}

      {/* Caption */}
      <div className="p-3">
        <textarea
          value={caption}
          onChange={e => onCaptionChange(e.target.value)}
          disabled={disabled}
          rows={4}
          className={cn(
            'w-full text-sm text-gray-800 resize-none border border-transparent rounded focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 p-1 transition-colors',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
          placeholder="Facebook caption..."
        />
      </div>

      {/* Platform label */}
      <div className="px-3 pb-3">
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          Facebook
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MOCK INSTAGRAM PREVIEW
// ─────────────────────────────────────────────

function InstagramPreview({
  caption,
  imageUrl,
  onCaptionChange,
  disabled,
}: {
  caption: string;
  imageUrl: string | null;
  onCaptionChange: (val: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border border-store-border bg-white overflow-hidden shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/></svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">your_store</p>
        </div>
      </div>

      {/* Image at 4:5 */}
      {imageUrl ? (
        <div className="w-full" style={{ aspectRatio: '4/5', background: '#f0f0f0' }}>
          <img
            src={imageUrl}
            alt="Post preview"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full bg-surface-raised flex items-center justify-center text-text-tertiary text-sm" style={{ aspectRatio: '4/5' }}>
          No image
        </div>
      )}

      {/* Caption */}
      <div className="p-3">
        <textarea
          value={caption}
          onChange={e => onCaptionChange(e.target.value)}
          disabled={disabled}
          rows={4}
          className={cn(
            'w-full text-sm text-gray-800 resize-none border border-transparent rounded focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 p-1 transition-colors',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
          placeholder="Instagram caption..."
        />
      </div>

      {/* Platform label */}
      <div className="px-3 pb-3">
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          Instagram
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REGENERATING OVERLAY
// ─────────────────────────────────────────────

function RegeneratingOverlay() {
  return (
    <div className="absolute inset-0 bg-surface/70 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
      <div className="flex flex-col items-center gap-2">
        <svg className="animate-spin h-8 w-8 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p className="text-sm text-text-secondary">Regenerating...</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

type PostReviewPanelProps = {
  postId: string;
  onClose: () => void;
};

export default function PostReviewPanel({ postId, onClose }: PostReviewPanelProps) {
  const qc = useQueryClient();

  // ── Remote data ──────────────────────────────
  const { data: post, isLoading } = useQuery<PostData>({
    queryKey: ['social-post', postId],
    queryFn: async () => {
      const res = await fetch(`/api/social/${postId}`, { credentials: 'include' });
      const json = await res.json();
      return json.data as PostData;
    },
    enabled: !!postId,
  });

  // ── Local state ───────────────────────────────
  const [fbCaption, setFbCaption] = useState('');
  const [igCaption, setIgCaption] = useState('');
  const [tone, setTone] = useState(33); // 0–100; default: professional-ish
  const [length, setLength] = useState(1); // 0=short, 1=medium, 2=long
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Seed local state once when post data arrives
  const seeded = useRef(false);
  useEffect(() => {
    if (post && !seeded.current) {
      setFbCaption(post.facebookCaption ?? '');
      setIgCaption(post.instagramCaption ?? '');
      seeded.current = true;
    }
  }, [post]);

  // Reset seed flag when postId changes
  useEffect(() => {
    seeded.current = false;
    setShowScheduler(false);
    setScheduledAt('');
    setIsRegenerating(false);
    setTone(33);
    setLength(1);
  }, [postId]);

  // ── Debounce helpers ──────────────────────────
  const toneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lengthDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerRegenerate = useCallback(
    (overrideTone?: number, overrideLength?: number) => {
      const t = overrideTone ?? tone;
      const l = overrideLength ?? length;
      regenerateMutation.mutate({
        postId,
        tone: toneToLabel(t),
        length: LENGTH_LABELS[l],
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [postId, tone, length],
  );

  const handleToneChange = (val: number) => {
    setTone(val);
    if (toneDebounce.current) clearTimeout(toneDebounce.current);
    toneDebounce.current = setTimeout(() => triggerRegenerate(val, length), 800);
  };

  const handleLengthChange = (val: number) => {
    setLength(val);
    if (lengthDebounce.current) clearTimeout(lengthDebounce.current);
    lengthDebounce.current = setTimeout(() => triggerRegenerate(tone, val), 800);
  };

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (toneDebounce.current) clearTimeout(toneDebounce.current);
      if (lengthDebounce.current) clearTimeout(lengthDebounce.current);
    };
  }, []);

  // ── Regenerate mutation ───────────────────────
 const regenerateMutation = useMutation<
    { facebookCaption: string; instagramCaption: string },
    Error,
    { postId: string; tone: ToneLabel; length: LengthLabel }
  >({
    mutationFn: async (vars) => {
      setIsRegenerating(true);
      const res = await fetch('/api/social/regenerate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Regeneration failed');
      return json.data;
    },
    onSuccess: (data) => {
      setFbCaption(data.facebookCaption);
      setIgCaption(data.instagramCaption);
      setIsRegenerating(false);
      qc.invalidateQueries({ queryKey: ['social-post', postId] });
    },
    onError: (err) => {
      setIsRegenerating(false);
      // Restore from cached post if available
      if (post) {
        setFbCaption(post.facebookCaption ?? '');
        setIgCaption(post.instagramCaption ?? '');
      }
      toast.error(err.message ?? 'Regeneration failed. Please try again.');
    },
  });

  // ── Approve (Post Now) mutation ───────────────
  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/social/approve', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, facebookCaption: fbCaption, instagramCaption: igCaption }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Publish failed');
      return json;
    },
    onSuccess: () => {
      toast.success('Post published!');
      qc.invalidateQueries({ queryKey: ['social'] });
      qc.invalidateQueries({ queryKey: ['social-post', postId] });
      onClose();
    },
    onError: (err: Error) => {
      const msg = err.message ?? 'Publish failed';
      if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('auth')) {
        toast.error('Facebook token expired. Please reconnect in Settings > Social Media.');
      } else {
        toast.error(msg);
      }
    },
  });

  // ── Schedule mutation ─────────────────────────
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!scheduledAt) throw new Error('Please select a date and time.');
      const res = await fetch('/api/social/schedule', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          facebookCaption: fbCaption,
          instagramCaption: igCaption,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Schedule failed');
      return json;
    },
    onSuccess: () => {
      toast.success('Post scheduled!');
      qc.invalidateQueries({ queryKey: ['social'] });
      qc.invalidateQueries({ queryKey: ['social-post', postId] });
      qc.invalidateQueries({ queryKey: ['social', undefined, 'scheduled'] });
      qc.invalidateQueries({ queryKey: ['social', undefined, 'pending'] });
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Could not schedule post.');
    },
  });

  // ── Reject mutation ───────────────────────────
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/social/reject', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Reject failed');
      return json;
    },
    onSuccess: () => {
      toast.info('Post rejected.');
      qc.invalidateQueries({ queryKey: ['social'] });
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Could not reject post.');
    },
  });

  // ── Derived image URLs ────────────────────────
  const fbImage = post?.imageUrls?.facebook?.[0] ?? null;
  const igImage = post?.imageUrls?.instagram?.[0] ?? null;

  const isBusy =
    isRegenerating ||
    approveMutation.isPending ||
    scheduleMutation.isPending ||
    rejectMutation.isPending;

  // ── Drawer footer ─────────────────────────────
  const drawerFooter = (
    <div className="flex items-center justify-between gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => rejectMutation.mutate()}
        disabled={isBusy}
        loading={rejectMutation.isPending}
        className="text-error hover:text-error"
      >
        Reject
      </Button>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowScheduler(v => !v)}
          disabled={isBusy}
        >
          {showScheduler ? 'Hide Scheduler' : 'Schedule'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => approveMutation.mutate()}
          disabled={isBusy}
          loading={approveMutation.isPending}
        >
          Post Now
        </Button>
      </div>
    </div>
  );

  return (
    <DrawerStub
      open={true}
      onClose={onClose}
      title="Review Post"
      width={900}
      footer={drawerFooter}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <svg className="animate-spin h-8 w-8 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Controls ── */}
          <div className="flex flex-col gap-4 bg-surface-raised rounded-lg p-4">
            {/* Tone slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-text-secondary">Tone</span>
                <span className="text-xs text-accent font-medium capitalize">{toneToLabel(tone)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary shrink-0">Professional</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={tone}
                  onChange={e => handleToneChange(Number(e.target.value))}
                  disabled={isBusy}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs text-text-tertiary shrink-0">Playful</span>
              </div>
            </div>

            {/* Length slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-text-secondary">Length</span>
                <span className="text-xs text-accent font-medium capitalize">{LENGTH_LABELS[length]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary shrink-0">Short</span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={length}
                  onChange={e => handleLengthChange(Number(e.target.value))}
                  disabled={isBusy}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs text-text-tertiary shrink-0">Long</span>
              </div>
            </div>

            {/* Regenerate button */}
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => triggerRegenerate()}
                disabled={isBusy}
                loading={isRegenerating}
              >
                <svg className="mr-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M8 16H3v5"/>
                </svg>
                Regenerate
              </Button>
            </div>
          </div>

          {/* ── Scheduler ── */}
          {showScheduler && (
            <div className="bg-surface-raised rounded-lg p-4 flex flex-col gap-3">
              <p className="text-sm font-medium text-text-primary">Schedule for later</p>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={new Date().toISOString().slice(0, 16)}
                onChange={e => setScheduledAt(e.target.value)}
                className="bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => scheduleMutation.mutate()}
                disabled={!scheduledAt || isBusy}
                loading={scheduleMutation.isPending}
                className="self-end"
              >
                Confirm Schedule
              </Button>
            </div>
          )}

          {/* ── Previews ── */}
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
            {isRegenerating && <RegeneratingOverlay />}

            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">Facebook</p>
              <FacebookPreview
                caption={fbCaption}
                imageUrl={fbImage}
                onCaptionChange={setFbCaption}
                disabled={isBusy}
              />
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">Instagram</p>
              <InstagramPreview
                caption={igCaption}
                imageUrl={igImage}
                onCaptionChange={setIgCaption}
                disabled={isBusy}
              />
            </div>
          </div>

        </div>
      )}
    </DrawerStub>
  );
}