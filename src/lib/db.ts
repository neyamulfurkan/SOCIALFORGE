import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

if (!globalThis.__prisma) {
  globalThis.__prisma = new PrismaClient({
    transactionOptions: {
      timeout: 15000,
      maxWait: 10000,
    },
  });
}

export const prisma = globalThis.__prisma;