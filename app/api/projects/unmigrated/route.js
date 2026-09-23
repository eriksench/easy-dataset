import { NextResponse } from 'next/server';

/**
 * Get list of unmigrated projects
 * @returns {Promise<Response>} Response containing unmigrated project IDs
 */
export async function GET(request) {
  return NextResponse.json({ success: true, data: [] });
}
