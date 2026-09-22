import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  return NextResponse.json({ user: session.user, expiresAt: session.expiresAt });
}
