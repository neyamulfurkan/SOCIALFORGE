// src/app/robots.ts
// Instructs search engine crawlers which paths to index.
// Store pages are public and fully indexable.
// Dashboard, admin, API, and auth routes are blocked.

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  return {
    rules: [
      {
        // Allow all crawlers on public store pages
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/dashboard/',
          '/admin',
          '/admin/',
          '/api/',
          '/login',
          '/register',
          '/onboarding',
        ],
      },
      {
        // Explicitly allow Googlebot on store pages
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/dashboard',
          '/dashboard/',
          '/admin',
          '/admin/',
          '/api/',
          '/login',
          '/register',
          '/onboarding',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}