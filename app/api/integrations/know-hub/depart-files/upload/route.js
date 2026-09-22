import { NextResponse } from 'next/server';
import { uploadDepartmentFile } from '@/lib/integrations/know-hub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const metadataValue = formData.get('metadata');

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Artifact file is required' }, { status: 400 });
    }

    let metadata;
    try {
      const metadataText = metadataValue instanceof File ? await metadataValue.text() : String(metadataValue || '');
      metadata = JSON.parse(metadataText);
    } catch {
      return NextResponse.json({ error: 'Artifact metadata must be valid JSON' }, { status: 400 });
    }

    if (!metadata.fileTitle?.trim() || !metadata.secretLevel?.trim() || !metadata.artifactType?.trim()) {
      return NextResponse.json({ error: 'File title, secret level and artifact type are required' }, { status: 400 });
    }

    const result = await uploadDepartmentFile(file, metadata);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to upload artifact to Know Hub:', String(error));
    return NextResponse.json({ error: error.message || 'Failed to upload artifact' }, { status: 502 });
  }
}
