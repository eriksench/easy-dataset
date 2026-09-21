import { NextResponse } from 'next/server';
import { getProject } from '@/lib/db/projects';
import { FILE } from '@/constant';
import { downloadDepartmentFile } from '@/lib/integrations/know-hub';
import { normalizeDocument, saveProjectDocument } from '@/lib/services/document-import';

const MAX_FILES_PER_IMPORT = 20;

export async function POST(request, { params }) {
  const { projectId } = params;
  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project does not exist' }, { status: 404 });
  }

  let requestData;
  try {
    requestData = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fileIds = [
    ...new Set(
      (requestData.fileIds || [])
        .map(String)
        .map(value => value.trim())
        .filter(Boolean)
    )
  ];
  if (fileIds.length === 0) {
    return NextResponse.json({ error: 'At least one file ID is required' }, { status: 400 });
  }
  if (fileIds.length > MAX_FILES_PER_IMPORT) {
    return NextResponse.json(
      { error: `A maximum of ${MAX_FILES_PER_IMPORT} files can be imported at once` },
      { status: 400 }
    );
  }

  const succeeded = [];
  const failed = [];
  for (const sourceId of fileIds) {
    try {
      const downloaded = await downloadDepartmentFile(sourceId);
      if (downloaded.content.length > FILE.MAX_FILE_SIZE) {
        throw new Error(`File exceeds the ${FILE.MAX_FILE_SIZE / 1024 / 1024} MiB limit`);
      }
      const normalized = await normalizeDocument(downloaded);
      const saved = await saveProjectDocument({ projectId, ...normalized });
      succeeded.push({ sourceId, fileId: saved.fileId, fileName: saved.fileName });
    } catch (error) {
      console.error(`Failed to import department file ${sourceId}:`, String(error));
      failed.push({ sourceId, message: error.message || 'Import failed' });
    }
  }

  return NextResponse.json({ succeeded, failed });
}
