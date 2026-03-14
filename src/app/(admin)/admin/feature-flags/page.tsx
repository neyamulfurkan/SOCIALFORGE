// src/app/(admin)/admin/feature-flags/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CACHE_TTL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import FeatureFlagsClient from './FeatureFlagsClient';
import { KNOWN_FLAGS } from './types';
import type { FlagOverride, ResolvedFlag } from './types';

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default async function AdminFeatureFlagsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/login');

  const [globalFlags, businessOverrides] = await Promise.all([
    prisma.platformConfig.findMany({
      where: { businessId: null, key: { startsWith: 'flag:' } },
    }),
    prisma.platformConfig.findMany({
      where: { businessId: { not: null }, key: { startsWith: 'flag:' } },
      include: {
        business: { select: { name: true } },
      },
    }),
  ]);

  const globalMap = new Map(globalFlags.map((g) => [g.key, g.value === 'true']));

  const overridesByKey = new Map<string, FlagOverride[]>();
  for (const row of businessOverrides) {
    const override: FlagOverride = {
      businessId: row.businessId!,
      businessName: (row as typeof row & { business?: { name: string } }).business?.name ?? row.businessId!,
      enabled: row.value === 'true',
    };
    const existing = overridesByKey.get(row.key) ?? [];
    existing.push(override);
    overridesByKey.set(row.key, existing);
  }

  const flags: ResolvedFlag[] = KNOWN_FLAGS.map((f) => ({
    ...f,
    enabled: globalMap.get(f.key) ?? true, // default to enabled if not explicitly set
    overrides: overridesByKey.get(f.key) ?? [],
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
          Feature Flags
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Toggle features globally or override them per business. Changes take effect within{' '}
          {CACHE_TTL.FLAGS / 60} minutes via cache expiry.
        </p>
      </div>

      <FeatureFlagsClient flags={flags} />
    </div>
  );
}