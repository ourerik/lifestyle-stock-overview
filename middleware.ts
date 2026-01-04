import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth0 } from './lib/auth0';

export async function middleware(request: NextRequest) {
  const authResponse = await auth0.middleware(request);

  // Let auth routes pass through
  if (request.nextUrl.pathname.startsWith('/auth')) {
    return authResponse;
  }

  // Let cron endpoints pass through (they use CRON_SECRET for auth)
  if (request.nextUrl.pathname.startsWith('/api/cron/')) {
    return authResponse;
  }

  // Check if user is authenticated
  const session = await auth0.getSession(request);

  if (!session) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return authResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
