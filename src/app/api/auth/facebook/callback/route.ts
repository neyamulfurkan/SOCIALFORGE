import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// ─────────────────────────────────────────────
// GET — Facebook OAuth callback
// Called by Facebook after the user grants permissions in the popup.
// Exchanges the short-lived code for a long-lived Page Access Token,
// fetches the connected Page details, saves everything to BusinessConfig,
// then closes the popup by posting a message back to the opener window.
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Build the HTML that closes the popup and posts the result back to the opener
  function closePopupHtml(payload: Record<string, unknown>): NextResponse {
    const json = JSON.stringify(payload);
    const html = `<!DOCTYPE html>
<html>
<head><title>Connecting…</title></head>
<body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage(${json}, window.location.origin);
    }
  } catch(e) {}
  window.close();
</script>
<p style="font-family:sans-serif;padding:24px;color:#111;">
  ${payload.success ? '✓ Connected! This window will close automatically.' : '✗ Error: ' + String(payload.error)}
</p>
</body>
</html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Handle user denying the OAuth request
  if (error) {
    return closePopupHtml({
      success: false,
      error: errorDescription ?? error,
    });
  }

  if (!code) {
    return closePopupHtml({
      success: false,
      error: 'No authorization code received from Facebook.',
    });
  }

  // Verify the user is authenticated
  const session = await auth();
  if (!session?.user?.businessId) {
    return closePopupHtml({
      success: false,
      error: 'You must be logged in to connect Facebook.',
    });
  }

  const businessId = session.user.businessId;

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return closePopupHtml({
      success: false,
      error: 'Facebook App credentials are not configured on the server.',
    });
  }

  const redirectUri =
    (process.env.NEXTAUTH_URL ?? '') + '/api/auth/facebook/callback';

  try {
    // ── Step 1: Exchange code for short-lived user access token ──────────────
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${appSecret}` +
        `&code=${code}`,
      { cache: 'no-store' },
    );

    if (!tokenRes.ok) {
      const err = (await tokenRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(
        err.error?.message ?? 'Failed to exchange code for token',
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const shortLivedToken = tokenData.access_token;

    // ── Step 2: Exchange for long-lived user token (60 days) ─────────────────
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${appId}` +
        `&client_secret=${appSecret}` +
        `&fb_exchange_token=${shortLivedToken}`,
      { cache: 'no-store' },
    );

    if (!longTokenRes.ok) {
      const err = (await longTokenRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(err.error?.message ?? 'Failed to get long-lived token');
    }

    const longTokenData = (await longTokenRes.json()) as {
      access_token: string;
    };
    const longLivedUserToken = longTokenData.access_token;

    // ── Step 3: Get the list of Pages the user manages ───────────────────────
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}&fields=id,name,access_token`,
      { cache: 'no-store' },
    );

    if (!pagesRes.ok) {
      const err = (await pagesRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(err.error?.message ?? 'Failed to fetch Pages');
    }

    const pagesData = (await pagesRes.json()) as {
      data: Array<{ id: string; name: string; access_token: string }>;
    };

    if (!pagesData.data || pagesData.data.length === 0) {
      return closePopupHtml({
        success: false,
        error:
          'No Facebook Pages found. Make sure you manage at least one Page and granted access to it.',
      });
    }

    // Use the first page — if the user manages multiple pages, they can
    // manually correct the Page ID in the settings field after connecting.
    const page = pagesData.data[0];
    const pageId = page.id;
    const pageName = page.name;
    // Page tokens from /me/accounts are already long-lived (never expire
    // as long as the user token is valid and the page connection exists).
    const pageToken = page.access_token;

    // ── Step 4: Try to get the connected Instagram Business Account ───────────
    let instagramAccountId: string | null = null;
    try {
      const igRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`,
        { cache: 'no-store' },
      );
      if (igRes.ok) {
        const igData = (await igRes.json()) as {
          instagram_business_account?: { id: string };
        };
        instagramAccountId =
          igData.instagram_business_account?.id ?? null;
      }
    } catch {
      // Instagram not connected — non-fatal, continue without it
    }

    // ── Step 5: Save everything to BusinessConfig ─────────────────────────────
    await prisma.businessConfig.update({
      where: { businessId },
      data: {
        facebookPageId: pageId,
        facebookPageToken: pageToken,
        messengerEnabled: true,
        ...(instagramAccountId ? { instagramAccountId } : {}),
      },
    });

    // ── Step 6: Close the popup and pass result back to the settings page ─────
    // We do NOT send the token through postMessage — it stays server-side.
    // The settings page shows a connected indicator and reloads the field.
    return closePopupHtml({
      success: true,
      pageId,
      pageName,
      instagramAccountId,
      tokenSaved: true,
    });
  } catch (err) {
    console.error('[facebook/callback] error:', err);
    return closePopupHtml({
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    });
  }
}