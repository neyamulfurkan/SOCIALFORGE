import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth(function middleware(req) {
  const { nextUrl } = req;

  // Public endpoints — must bypass all auth checks
  if (nextUrl.pathname === '/api/admin/register') {
    return NextResponse.next();
  }

  // Business owner self-service routes — allow through to route handler
  // The route handler itself enforces ownership checks
  const session0 = req.auth;
  
  if (session0?.user?.role === 'BUSINESS_OWNER') {
    const selfServicePatterns = [
      /^\/api\/admin\/businesses\/[^/]+$/,           // PUT own business
      /^\/api\/admin\/businesses\/[^/]+\/config$/,   // PATCH own config
      /^\/api\/admin\/change-password$/,             // POST change password
      /^\/api\/admin\/platform-config$/,             // POST own API keys
      /^\/api\/admin\/business-config$/,             // GET/PATCH own business config
    ];
    if (selfServicePatterns.some((p) => p.test(nextUrl.pathname))) {
      return NextResponse.next();
    }
  }

  const session = req.auth;
  const isAuthenticated = !!session?.user;
  const role = session?.user?.role;

  const isAdminPath =
    nextUrl.pathname.startsWith('/admin') ||
    nextUrl.pathname.startsWith('/api/admin');
  const isDashboardPath = nextUrl.pathname.startsWith('/dashboard');

  if (isAdminPath) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (role !== 'SUPER_ADMIN') {
      if (nextUrl.pathname.startsWith('/api/admin')) {
        return NextResponse.json(
          { error: 'Forbidden', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  if (isDashboardPath && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/api/admin/:path*'],
};