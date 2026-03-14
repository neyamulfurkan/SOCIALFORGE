'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import type { ConversationWithMessages } from '@/lib/types';

// FILE 069 (MessagesInbox) not yet generated — lazy-loaded to defer
// resolution until it exists. Props contract documented in JSON below.
const MessagesInbox = dynamic(
  () => import('@/components/dashboard/MessagesInbox'),
  {
    ssr: false,
    loading: () => (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="h-16 bg-surface rounded-lg" />
            ))}
        </div>
      </div>
    ),
  },
);

export default function MessagesPage(): React.JSX.Element {
  const { data: session } = useSession();
  const businessId = session?.user?.businessId ?? null;

  const { data, isLoading } = useQuery<ConversationWithMessages[]>({
    queryKey: ['conversations', businessId],
    queryFn: async (): Promise<ConversationWithMessages[]> => {
      const res = await fetch('/api/messenger/conversations', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const json = await res.json();
      return (json.data ?? []) as ConversationWithMessages[];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (!businessId) return <></>;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="h-16 bg-surface rounded-lg" />
            ))}
        </div>
      </div>
    );
  }

  return (
    <MessagesInbox
      initialConversations={data ?? []}
      businessId={businessId}
    />
  );
}