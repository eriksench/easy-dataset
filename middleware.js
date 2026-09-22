import { NextResponse } from 'next/server';
import { getSessionFromRequest, SESSION_COOKIE_NAME } from '@/lib/auth/session';

function ssoEnabled() {
  return process.env.KNOW_HUB_SSO_ENABLED !== 'false';
}

function unauthorizedApi() {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

export async function middleware(request) {
  if (!ssoEnabled()) return NextResponse.next();

  const session = await getSessionFromRequest(request);
  if (session) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return unauthorizedApi();
  }

  const knowHubPublicUrl = process.env.KNOW_HUB_PUBLIC_URL;
  if (!knowHubPublicUrl) {
    return new NextResponse('KNOW_HUB_PUBLIC_URL is not configured', { status: 503 });
  }

  const launchUrl = new URL('/dataset-factory/launch/easy-dataset', knowHubPublicUrl);
  launchUrl.searchParams.set('returnPath', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(launchUrl);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|imgs/|auth/know-hub/callback|api/auth/know-hub/exchange).*)'
  ]
};
