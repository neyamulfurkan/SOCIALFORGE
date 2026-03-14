'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { formatRelativeTime } from '@/lib/utils';
import { ACTIVITY_TYPE_ICONS } from '@/lib/constants';
import type { ActivityItem } from '@/lib/types';

// ─── Icon map ────────────────────────────────────────────────────────────────

const IconComponents: Record<string, () => React.ReactElement> = {
  ShoppingBag: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  RefreshCw: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  MessageCircle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Globe: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  AlertCircle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

function ActivityIcon({ iconName, colorClass }: { iconName: string; colorClass: string }): React.ReactElement {
  const Icon = IconComponents[iconName];
  if (!Icon) {
    return <span className={colorClass}>●</span>;
  }
  return (
    <span className={colorClass}>
      <Icon />
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

type ActivityFeedProps = {
  initialActivities: ActivityItem[];
  businessId: string;
};

export default function ActivityFeed({
  initialActivities,
  businessId,
}: ActivityFeedProps): React.ReactElement {
  const { data } = useQuery<ActivityItem[]>({
    queryKey: ['activity', businessId],
    queryFn: async () => {
      const res = await fetch('/api/orders/activity', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch activity');
      const json = await res.json();
      return json.data ?? [];
    },
    initialData: initialActivities,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const activities: ActivityItem[] = data ?? initialActivities;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  return (
    <div className="bg-surface rounded-lg p-4 border border-border">
      <h2 className="font-semibold text-text-primary mb-4">Recent Activity</h2>

      <AnimatePresence initial={false}>
        {activities.slice(0, 20).map((item) => {
          const iconConfig = ACTIVITY_TYPE_ICONS[item.type] ?? {
            icon: '●',
            color: 'text-text-secondary',
          };
          const isNew = new Date(item.timestamp).getTime() > fiveMinutesAgo;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex gap-3 py-3 border-b border-border last:border-0"
            >
              {/* Icon circle */}
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  'bg-surface-raised',
                  iconConfig.color,
                ].join(' ')}
              >
                <ActivityIcon
                  iconName={iconConfig.icon}
                  colorClass={iconConfig.color}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-text-primary flex items-center gap-2">
                  {item.title}
                  {isNew && (
                    <span
                      className="w-2 h-2 bg-accent rounded-full inline-block flex-shrink-0"
                      aria-label="New"
                    />
                  )}
                </p>
                <p className="text-text-secondary text-xs mt-0.5 truncate">
                  {item.description}
                </p>
                {item.actionUrl && (
                  <a
                    href={item.actionUrl}
                    className="text-accent text-xs mt-1 inline-block hover:underline"
                  >
                    {item.actionLabel ?? 'View'}
                  </a>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-text-tertiary text-xs flex-shrink-0 pt-0.5">
                {formatRelativeTime(new Date(item.timestamp))}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {activities.length === 0 && (
        <p className="text-text-secondary text-sm text-center py-8">
          All quiet here. Your activity will appear as orders and events come in.
        </p>
      )}
    </div>
  );
}