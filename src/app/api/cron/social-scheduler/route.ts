import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  const scheduledPosts = await prisma.socialPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    include: {
      business: {
        include: {
          config: true,
        },
      },
    },
    take: 10,
    orderBy: { scheduledAt: 'asc' },
  });

  let processed = 0;
  let failed = 0;

  for (const post of scheduledPosts) {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: 'POSTING' },
    });

    try {
      const config = post.business.config;

      if (!config?.facebookPageToken || !config?.facebookPageId) {
        throw new Error('Missing Facebook credentials');
      }

      const imageUrls = post.imageUrls as { facebook: string[]; instagram: string[] };

      if (!imageUrls.facebook?.[0]) {
        throw new Error('No Facebook image URL available');
      }

      const fbRes = await fetch(
        'https://graph.facebook.com/v19.0/' + config.facebookPageId + '/photos',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: imageUrls.facebook[0],
            caption: post.facebookCaption,
            access_token: config.facebookPageToken,
          }),
        },
      );

      const fbData = await fbRes.json();

      if (!fbRes.ok) {
        throw new Error('Facebook post failed: ' + JSON.stringify(fbData));
      }

      let instagramPostId: string | undefined;

      if (config.instagramAccountId && imageUrls.instagram?.[0]) {
        try {
          const igMediaRes = await fetch(
            'https://graph.facebook.com/v19.0/' + config.instagramAccountId + '/media',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image_url: imageUrls.instagram[0],
                caption: post.instagramCaption,
                access_token: config.facebookPageToken,
              }),
            },
          );

          const igMedia = await igMediaRes.json();

          if (igMediaRes.ok && igMedia.id) {
            const igPublishRes = await fetch(
              'https://graph.facebook.com/v19.0/' + config.instagramAccountId + '/media_publish',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  creation_id: igMedia.id,
                  access_token: config.facebookPageToken,
                }),
              },
            );

            const igPublish = await igPublishRes.json();

            if (igPublishRes.ok && igPublish.id) {
              instagramPostId = igPublish.id;
            } else {
              console.error(
                '[social-scheduler] Instagram publish failed for post',
                post.id,
                igPublish,
              );
            }
          } else {
            console.error(
              '[social-scheduler] Instagram media creation failed for post',
              post.id,
              igMedia,
            );
          }
        } catch (igErr) {
          // Instagram failure does not fail the entire post — Facebook already succeeded
          console.error('[social-scheduler] Instagram error for post', post.id, igErr);
        }
      }

      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: 'LIVE',
          postedAt: new Date(),
          facebookPostId: fbData.id ?? fbData.post_id ?? null,
          ...(instagramPostId ? { instagramPostId } : {}),
        },
      });

      processed++;
    } catch (err) {
      console.error('[social-scheduler] Failed to publish post', post.id, err);

      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: 'FAILED' },
      });

      await prisma.activityLog.create({
        data: {
          businessId: post.businessId,
          type: 'POST_FAILED',
          title: 'Post failed to publish',
          description: err instanceof Error ? err.message : String(err),
          metadata: { postId: post.id },
        },
      });

      failed++;
    }
  }

  return NextResponse.json({ processed, failed });
}