import { NextResponse } from 'next/server';

/**
 * Delete project directory
 * @returns {Promise<Response>} Operation result response
 */
export async function POST(request) {
  return NextResponse.json({ success: false, error: 'Legacy project directory deletion is disabled' }, { status: 410 });
}
