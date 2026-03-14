import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const posts = await prisma.socialPost.findMany({
    where: {
      status: 'LIVE',
      facebookPostId: { not: null },
      postedAt: { lte: oneHourAgo },
      OR: [
        { lastInsightSync: null },
        { lastInsightSync: { lte: sixHoursAgo } },
      ],
    },
    include: {
      business: {
        include: { config: true },
      },
    },
    take: 20,
  });

  let updated = 0;
  let errors = 0;

  for (const post of posts) {
    const pageToken = post.business.config?.facebookPageToken;
    if (!pageToken) continue;

    try {
      const url =
        'https://graph.facebook.com/v19.0/' +
        post.facebookPostId +
        '/insights?metric=post_impressions,post_reach,post_reactions_by_type_total,post_clicks&access_token=' +
        pageToken;

      const res = await fetch(url);

      if (!res.ok) {
        console.error(
          'Graph API error for post',
          post.id,
          res.status,
          await res.text(),
        );
        errors++;
        continue;
      }

      const insightData = await res.json();
      const metricsMap: Record<string, number | Record<string, number>> = {};

      for (const metric of insightData.data ?? []) {
        metricsMap[metric.name] = metric.values?.[0]?.value ?? 0;
      }

      const reactionsRaw = metricsMap['post_reactions_by_type_total'];
      const reactions =
        typeof reactionsRaw === 'object' && reactionsRaw !== null
          ? Object.values(reactionsRaw as Record<string, number>).reduce(
              (a, b) => a + b,
              0,
            )
          : 0;

      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          reach: (metricsMap['post_reach'] as number) ?? post.reach,
          impressions:
            (metricsMap['post_impressions'] as number) ?? post.impressions,
          reactions: reactions || post.reactions,
          linkClicks:
            (metricsMap['post_clicks'] as number) ?? post.linkClicks,
          lastInsightSync: new Date(),
        },
      });

      updated++;
    } catch (err) {
      console.error('Insights sync error for post', post.id, err);
      errors++;
    }
  }

  return NextResponse.json({ updated, errors });
}