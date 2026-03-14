// src/app/(admin)/admin/settings/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import GlobalSettingsClient from './GlobalSettingsClient';

export default async function AdminSettingsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/login');

  const globalConfigs = await prisma.platformConfig.findMany({
    where: { businessId: null },
  });

  const configMap: Record<string, string> = {};
  for (const c of globalConfigs) {
    configMap[c.key] = c.value;
  }

  return <GlobalSettingsClient configMap={configMap} />;
}