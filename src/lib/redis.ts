// src/lib/redis.ts
import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();

export async function rateLimit(
  key: string,
  limit: number,
  window: number,
): Promise<{ success: boolean; remaining: number }> {
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();

    const count = results[0] as number;
    const ttl = results[1] as number;

    if (ttl === -1) {
      await redis.expire(key, window);
    }

    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
    };
  } catch {
    return { success: true, remaining: limit };
  }
}