import { NextResponse } from 'next/server';
import { sealSession, sessionCookieOptions } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeReturnPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/';
}

async function upstreamError(response) {
  try {
    const body = await response.text();
    return body || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function GET(request) {
  try {
    const code = new URL(request.url).searchParams.get('code');
    if (!code) return new NextResponse('Know-Hub SSO code is missing', { status: 400 });

    const baseUrl = (process.env.KNOW_HUB_BASE_URL || '').replace(/\/+$/, '');
    const integrationToken = process.env.KNOW_HUB_INTEGRATION_TOKEN || '';
    if (!baseUrl || !integrationToken) {
      return new NextResponse('Know-Hub integration is not configured', { status: 503 });
    }

    const upstream = await fetch(`${baseUrl}/integration/easy-dataset/sso/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Integration-Token': integrationToken
      },
      body: JSON.stringify({ code }),
      cache: 'no-store'
    });
    if (!upstream.ok) {
      return new NextResponse(`Know-Hub SSO exchange failed: ${await upstreamError(upstream)}`, {
        status: upstream.status
      });
    }
    const body = await upstream.json();
    const result = body?.result;
    if (body?.code !== 200 || !result?.accessToken || !result?.user) {
      return new NextResponse(body?.message || 'Know-Hub SSO exchange returned invalid data', { status: 502 });
    }

    const maxAge = Math.min(Number(result.expiresIn) || 0, 8 * 60 * 60);
    const value = await sealSession(
      { user: result.user, accessToken: result.accessToken },
      maxAge
    );
    const redirectUrl = new URL(safeReturnPath(result.returnPath), request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({ ...sessionCookieOptions(request.url, maxAge), value });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch (error) {
    console.error('Failed to complete Know-Hub SSO:', String(error));
    return new NextResponse(`Know-Hub SSO failed: ${error.message || String(error)}`, { status: 500 });
  }
}
