import { NextResponse } from 'next/server';
import { searchDepartmentFiles } from '@/lib/integrations/know-hub';
import { SUPPORTED_SOURCE_EXTENSIONS, normalizeExtension } from '@/lib/services/document-import';
import { getSessionFromRequest } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const pageNo = positiveInteger(searchParams.get('pageNo'), 1, 100000);
    const pageSize = positiveInteger(searchParams.get('pageSize'), 10, 50);
    const fileName = searchParams.get('fileName') || '';
    const secretLevel = searchParams.get('secretLevel') || '';
    const data = await searchDepartmentFiles({ fileName, secretLevel, pageNo, pageSize, accessToken: session.accessToken });

    return NextResponse.json({
      departmentName: session.user.departmentName,
      maxSecretLevel: session.user.maxSecretLevel,
      total: Number(data.allNo) || 0,
      items: (data.content || [])
        .filter(item => item.id != null && String(item.id).trim())
        .map(item => {
          const extension = normalizeExtension(item.file_ext);
          return {
            id: String(item.id),
            fileName: item.fileName,
            extension,
            secretLevel: item.secretLevel || '',
            supported: SUPPORTED_SOURCE_EXTENSIONS.has(extension)
          };
        })
    });
  } catch (error) {
    console.error('Failed to query Know Hub department files:', String(error));
    return NextResponse.json({ error: error.message || 'Failed to query department files' }, { status: 502 });
  }
}
