'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { POST_STATUS_LABELS } from '@/lib/constants';
import { formatRelativeTime, cn } from '@/lib/utils';

// ─── PostReviewPanel stub (FILE 068 not yet generated) ────────────────────────
// This stub provides the minimal interface needed for this file.
// When FILE 068 is generated, replace this stub with:
//   import PostReviewPanel from '@/components/dashboard/PostReviewPanel';
// FILE 068 MUST export a default component accepting: { postId: string; onClose: () => void }

function PostReviewPanelStub({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl h-full bg-surface flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Review Post</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-text-secondary">
            <p className="text-sm">Post Review Panel (FILE 068)</p>
            <p className="text-xs mt-1 text-text-tertiary">Post ID: {postId}</p>
            <p className="text-xs mt-2 text-text-tertiary">
              This panel will be implemented when FILE 068 is generated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SocialPost = {
  id: string;
  productId: string | null;
  facebookCaption: string;
  instagramCaption: string;
  imageUrls: { facebook: string[]; instagram: string[] };
  status: string;
  scheduledAt: string | null;
  postedAt: string | null;
  facebookPostId: string | null;
  instagramPostId: string | null;
  reach: number | null;
  impressions: number | null;
  reactions: number | null;
  linkClicks: number | null;
  createdAt: string;
  updatedAt: string;
};

type RulesConfig = {
  socialAutoApprove: boolean;
  defaultPostTime: string;
  facebookPageId: string | null;
  instagramAccountId: string | null;
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

import { toast } from '@/components/ui/Toast';
import PostReviewPanel from '@/components/dashboard/PostReviewPanel';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    PENDING_REVIEW: 'bg-warning/10 text-warning',
    SCHEDULED: 'bg-accent/10 text-accent',
    POSTING: 'bg-accent/10 text-accent',
    LIVE: 'bg-success/10 text-success',
    FAILED: 'bg-error/10 text-error',
    REJECTED: 'bg-surface text-text-secondary',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colorMap[status] ?? 'bg-surface text-text-secondary',
      )}
    >
      {POST_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center mb-4">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-text-tertiary"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </div>
      <p className="text-text-secondary text-sm">{message}</p>
    </div>
  );
}

// ─── PendingTab ───────────────────────────────────────────────────────────────

function PendingTab({
  posts,
  onReview,
}: {
  posts: SocialPost[];
  onReview: (id: string) => void;
}) {
  if (posts.length === 0) {
    return (
      <EmptyState message="No posts pending review. New products will generate drafts automatically." />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => (
        <motion.div
          key={post.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-surface border border-border rounded-lg overflow-hidden"
        >
          {/* Image preview */}
          {post.imageUrls.facebook[0] ? (
            <div className="aspect-video bg-surface-raised overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrls.facebook[0]}
                alt="Post preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-video bg-surface-raised flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-text-tertiary"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
          )}

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <StatusPill status={post.status} />
              <span className="text-xs text-text-tertiary">
                {formatRelativeTime(new Date(post.createdAt))}
              </span>
            </div>

            <p className="text-sm text-text-secondary line-clamp-2">
              {post.facebookCaption}
            </p>

            <button
              onClick={() => onReview(post.id)}
              className="w-full h-9 rounded-md bg-accent text-accent-text text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Review &amp; Post
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── ScheduledTab ─────────────────────────────────────────────────────────────

function ScheduledTab({
  posts,
  businessId,
  qc,
}: {
  posts: SocialPost[];
  businessId: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [listView, setListView] = useState(false);

  const rescheduleMutation = useMutation({
    mutationFn: async ({
      postId,
      scheduledAt,
    }: {
      postId: string;
      scheduledAt: string;
    }) => {
      const res = await fetch('/api/social/reschedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ postId, scheduledAt }),
      });
      if (!res.ok) throw new Error('Reschedule failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social', businessId, 'scheduled'] });
      toast.success('Post rescheduled');
    },
    onError: () => toast.error('Failed to reschedule post'),
  });

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  function postsForDay(day: number): SocialPost[] {
    const date = new Date(calYear, calMonth, day);
    return posts.filter((p) => {
      if (!p.scheduledAt) return false;
      return isSameDay(new Date(p.scheduledAt), date);
    });
  }

  function handleDrop(postId: string, day: number) {
    const d = new Date(calYear, calMonth, day, 10, 0, 0);
    rescheduleMutation.mutate({ postId, scheduledAt: d.toISOString() });
  }

  if (posts.length === 0 && !listView) {
    return (
      <EmptyState message="No scheduled posts. Approve a pending post and choose a date to schedule it." />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md hover:bg-surface-raised transition-colors text-text-secondary"
            aria-label="Previous month"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-sm font-medium text-text-primary w-36 text-center">
            {MONTH_NAMES[calMonth]} {calYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md hover:bg-surface-raised transition-colors text-text-secondary"
            aria-label="Next month"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => setListView((v) => !v)}
          className="text-xs text-text-secondary hover:text-text-primary border border-border rounded-md px-3 py-1.5 transition-colors"
        >
          {listView ? 'Calendar view' : 'List view'}
        </button>
      </div>

      {listView ? (
        /* List view */
        <div className="space-y-3">
          {posts.length === 0 ? (
            <EmptyState message="No scheduled posts." />
          ) : (
            posts
              .slice()
              .sort((a, b) =>
                new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
              )
              .map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-4 bg-surface border border-border rounded-lg p-4"
                >
                  {post.imageUrls.facebook[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.imageUrls.facebook[0]}
                      alt=""
                      className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-surface-raised flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary line-clamp-1">
                      {post.facebookCaption}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {post.scheduledAt
                        ? new Date(post.scheduledAt).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                  <StatusPill status={post.status} />
                </div>
              ))
          )}
        </div>
      ) : (
        /* Calendar grid */
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-medium text-text-tertiary"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-border" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dayPosts = postsForDay(day);
              const isToday = isSameDay(
                new Date(calYear, calMonth, day),
                today,
              );

              return (
                <div
                  key={day}
                  className="min-h-[80px] border-b border-r border-border p-1.5"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const postId = e.dataTransfer.getData('postId');
                    if (postId) handleDrop(postId, day);
                  }}
                >
                  <div
                    className={cn(
                      'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                      isToday
                        ? 'bg-accent text-accent-text'
                        : 'text-text-secondary',
                    )}
                  >
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.map((post) => (
                      <motion.div
                        key={post.id}
                        draggable
                        onDragStart={(e) => {
                          (e as unknown as DragEvent).dataTransfer?.setData(
                            'postId',
                            post.id,
                          );
                        }}
                        whileDrag={{ scale: 1.04, opacity: 0.8 }}
                        className="text-xs rounded px-1.5 py-0.5 bg-accent/10 text-accent truncate cursor-grab"
                        title={post.facebookCaption}
                      >
                        {post.scheduledAt
                          ? new Date(post.scheduledAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}{' '}
                        post
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

function HistoryTab({ posts }: { posts: SocialPost[] }) {
  const [platform, setPlatform] = useState<'all' | 'facebook' | 'instagram'>('all');

  const filtered = posts.filter((p) => {
    if (platform === 'facebook') return !!p.facebookPostId;
    if (platform === 'instagram') return !!p.instagramPostId;
    return true;
  });

  if (posts.length === 0) {
    return (
      <EmptyState message="No published posts yet. Post history and performance metrics will appear here." />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'facebook', 'instagram'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              platform === p
                ? 'bg-accent text-accent-text border-accent'
                : 'border-border text-text-secondary hover:text-text-primary',
            )}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-tertiary">
                  Post
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-tertiary">
                  Reach
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-tertiary">
                  Impressions
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-tertiary">
                  Reactions
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-tertiary">
                  Link Clicks
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-tertiary">
                  Posted
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-border last:border-0 hover:bg-surface-raised transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {post.imageUrls.facebook[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.imageUrls.facebook[0]}
                          alt=""
                          className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-surface-raised flex-shrink-0" />
                      )}
                      <p className="text-text-primary line-clamp-1 max-w-[220px]">
                        {post.facebookCaption}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                    {post.reach?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                    {post.impressions?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                    {post.reactions?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                    {post.linkClicks?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary text-xs">
                    {post.postedAt
                      ? formatRelativeTime(new Date(post.postedAt))
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── RulesTab ─────────────────────────────────────────────────────────────────

function RulesTab({ businessId }: { businessId: string }) {
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<RulesConfig>({
    queryKey: ['social', businessId, 'rules'],
    queryFn: async () => {
      const res = await fetch('/api/admin/business-config', {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data ?? {};
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });

  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [postTime, setPostTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveAutoApprove = autoApprove ?? config?.socialAutoApprove ?? false;
  const effectivePostTime = postTime ?? config?.defaultPostTime ?? '10:00';

  async function saveRules() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/business-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          socialAutoApprove: effectiveAutoApprove,
          defaultPostTime: effectivePostTime,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      qc.invalidateQueries({ queryKey: ['social', businessId, 'rules'] });
      toast.success('Automation rules saved');
    } catch {
      toast.error('Failed to save rules');
    } finally {
      setSaving(false);
    }
  }

  const facebookConnected = !!(config?.facebookPageId);
  const instagramConnected = !!(config?.instagramAccountId);

  return (
    <div className="max-w-xl space-y-6">
      {/* Connected accounts */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Connected Accounts</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                f
              </div>
              <span className="text-sm text-text-primary">Facebook Page</span>
            </div>
            {facebookConnected ? (
              <span className="text-xs text-success font-medium">Connected</span>
            ) : (
              <a
                href="/dashboard/settings#social"
                className="text-xs text-accent hover:underline"
              >
                Connect in Settings
              </a>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-400 flex items-center justify-center text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </div>
              <span className="text-sm text-text-primary">Instagram</span>
            </div>
            {instagramConnected ? (
              <span className="text-xs text-success font-medium">Connected</span>
            ) : (
              <a
                href="/dashboard/settings#social"
                className="text-xs text-accent hover:underline"
              >
                Connect in Settings
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Automation settings */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
        <h3 className="text-sm font-semibold text-text-primary">Automation</h3>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-surface-raised rounded-md animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Auto-approve toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-text-primary font-medium">Auto-approve posts</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  When enabled, AI-generated posts publish without manual review.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={effectiveAutoApprove}
                onClick={() => setAutoApprove(!effectiveAutoApprove)}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  effectiveAutoApprove ? 'bg-accent' : 'bg-border',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                    effectiveAutoApprove ? 'translate-x-5' : 'translate-x-0',
                  )}
                />
              </button>
            </div>

            {/* Default post time */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-text-primary font-medium">Default post time</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  When scheduling auto-approved posts.
                </p>
              </div>
              <input
                type="time"
                value={effectivePostTime}
                onChange={(e) => setPostTime(e.target.value)}
                className="bg-surface border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <button
              onClick={saveRules}
              disabled={saving}
              className={cn(
                'w-full h-10 rounded-md bg-accent text-accent-text text-sm font-medium transition-colors',
                saving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent-hover',
              )}
            >
              {saving ? 'Saving…' : 'Save Rules'}
            </button>
          </>
        )}
      </div>

      {!facebookConnected && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-sm text-warning">
          No Facebook Page connected. Connect one in{' '}
          <a href="/dashboard/settings#social" className="underline font-medium">
            Settings → Social Media
          </a>{' '}
          to enable posting.
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId;
  const [tab, setTab] = useState<'pending' | 'scheduled' | 'history' | 'rules'>('pending');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: pendingData, isLoading: pendingLoading } = useQuery<SocialPost[]>({
    queryKey: ['social', businessId, 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/social?status=PENDING_REVIEW', {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!businessId && tab === 'pending',
    staleTime: 30_000,
  });

  const { data: scheduledData, isLoading: scheduledLoading } = useQuery<SocialPost[]>({
    queryKey: ['social', businessId, 'scheduled'],
    queryFn: async () => {
      const res = await fetch('/api/social/calendar', {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!businessId && tab === 'scheduled',
    staleTime: 30_000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<SocialPost[]>({
    queryKey: ['social', businessId, 'history'],
    queryFn: async () => {
      const res = await fetch('/api/social/history', {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data ?? [];
    },
    enabled: !!businessId && tab === 'history',
    staleTime: 30_000,
  });

  const TABS = [
    { id: 'pending', label: 'Pending Review' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'history', label: 'History' },
    { id: 'rules', label: 'Rules' },
  ] as const;

  const isLoading =
    (tab === 'pending' && pendingLoading) ||
    (tab === 'scheduled' && scheduledLoading) ||
    (tab === 'history' && historyLoading);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary">Social Media</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage AI-generated posts, review drafts, and track performance.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'pb-3 px-4 text-sm font-medium border-b-2 transition-colors',
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
            {t.id === 'pending' && (pendingData?.length ?? 0) > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent text-accent-text text-[10px] font-bold">
                {pendingData!.length > 9 ? '9+' : pendingData!.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="aspect-video bg-surface-raised animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-surface-raised rounded animate-pulse" />
                <div className="h-4 bg-surface-raised rounded w-2/3 animate-pulse" />
                <div className="h-9 bg-surface-raised rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {tab === 'pending' && (
            <PendingTab
              posts={pendingData ?? []}
              onReview={setSelectedPostId}
            />
          )}
          {tab === 'scheduled' && (
            <ScheduledTab
              posts={scheduledData ?? []}
              businessId={businessId ?? ''}
              qc={qc}
            />
          )}
          {tab === 'history' && <HistoryTab posts={historyData ?? []} />}
          {tab === 'rules' && <RulesTab businessId={businessId ?? ''} />}
        </>
      )}

      {/* PostReviewPanel */}
      <AnimatePresence>
        {selectedPostId && (
          <PostReviewPanel
            postId={selectedPostId}
            onClose={() => setSelectedPostId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}