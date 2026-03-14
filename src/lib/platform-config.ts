import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { CACHE_TTL } from '@/lib/constants';
import type { PlatformConfigKey } from '@/lib/types';

export async function getConfigValue(
  key: PlatformConfigKey,
  businessId?: string,
): Promise<string | null> {
  const cacheKey = 'config:' + (businessId ?? 'global') + ':' + key;

  try {
    const cached = await redis.get<string>(cacheKey);
    if (cached !== null) return cached;
  } catch {}

  // FIX: Two separate queries instead of OR + orderBy.
  // The OR + orderBy: { businessId: 'desc' } pattern is unreliable because
  // PostgreSQL sorts NULLs last in DESC, so business-specific rows are never
  // preferred over global ones. We now explicitly prefer business-specific,
  // then fall back to global (businessId = null).

  let value: string | null = null;

  if (businessId) {
    // 1. Try business-specific row first
    const businessRow = await prisma.platformConfig.findFirst({
      where: { key, businessId },
    });
    if (businessRow) {
      value = businessRow.value;
    }
  }

  if (value === null) {
    // 2. Fall back to global row (businessId IS NULL)
    const globalRow = await prisma.platformConfig.findFirst({
      where: { key, businessId: null },
    });
    if (globalRow) {
      value = globalRow.value;
    }
  }

  if (value !== null) {
    try {
      await redis.setex(cacheKey, CACHE_TTL.CONFIG, value);
    } catch {}
  }

  return value;
}

export async function setConfigValue(
  key: PlatformConfigKey,
  value: string,
  businessId?: string,
): Promise<void> {
  // FIX: Replace upsert with explicit findFirst + update/create.
  // The Prisma upsert with `businessId: null as unknown as string` in the
  // where clause does not work because PostgreSQL NULL != NULL in unique
  // index lookups — the upsert where never matches the existing global row,
  // so it always tries to INSERT and hits a unique constraint violation or
  // silently creates a duplicate depending on DB state.

  const existing = await prisma.platformConfig.findFirst({
    where: {
      key,
      businessId: businessId ?? null,
    },
  });

  if (existing) {
    await prisma.platformConfig.update({
      where: { id: existing.id },
      data: { value },
    });
  } else {
    await prisma.platformConfig.create({
      data: {
        key,
        value,
        businessId: businessId ?? null,
      },
    });
  }

  await clearConfigCache(businessId);
}

export async function getGroqKey(
  feature: 'CHATBOT' | 'DESCRIPTIONS' | 'SOCIAL' | 'MESSENGER',
  businessId?: string,
): Promise<string> {
  const key = ('GROQ_KEY_' + feature) as PlatformConfigKey;
  const value = await getConfigValue(key, businessId);

  if (!value) {
    throw new Error(
      `Groq key for ${feature} not configured. Please set it in the admin panel.`,
    );
  }

  return value;
}

export async function clearConfigCache(businessId?: string): Promise<void> {
  const scope = businessId ?? 'global';
  const keys: PlatformConfigKey[] = [
    'GROQ_KEY_CHATBOT',
    'GROQ_KEY_DESCRIPTIONS',
    'GROQ_KEY_SOCIAL',
    'GROQ_KEY_MESSENGER',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'RESEND_API_KEY',
    'STRIPE_PLATFORM_KEY',
  ];

  try {
    await Promise.all(keys.map((k) => redis.del('config:' + scope + ':' + k)));
  } catch {}
}

export async function getFeatureFlags(
  businessId: string,
): Promise<Record<string, boolean>> {
  const cacheKey = 'flags:' + businessId;

  try {
    const cached = await redis.get<Record<string, boolean>>(cacheKey);
    if (cached) return cached;
  } catch {}

  const [globalFlags, businessFlags] = await Promise.all([
    prisma.platformConfig.findMany({
      where: { businessId: null, key: { startsWith: 'flag:' } },
    }),
    prisma.platformConfig.findMany({
      where: { businessId, key: { startsWith: 'flag:' } },
    }),
  ]);

  const merged: Record<string, boolean> = {};
  for (const f of globalFlags) merged[f.key] = f.value === 'true';
  for (const f of businessFlags) merged[f.key] = f.value === 'true';

  try {
    await redis.setex(cacheKey, CACHE_TTL.FLAGS, JSON.stringify(merged));
  } catch {}

  return merged;
}