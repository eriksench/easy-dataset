import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session';

export async function POST(request) {
  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...sessionCookieOptions(request.url, 0), name: SESSION_COOKIE_NAME, value: '', maxAge: 0 });
  return response;
}
