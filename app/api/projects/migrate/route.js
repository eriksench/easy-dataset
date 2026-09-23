import { NextResponse } from 'next/server';

/**
 * Start a migration task
 */
export async function POST() {
  return NextResponse.json({ success: false, error: 'Legacy project migration is disabled' }, { status: 410 });
}

/**
 * Get migration task status
 */
export async function GET(request) {
  return NextResponse.json({ success: false, error: 'Legacy project migration is disabled' }, { status: 410 });
}
