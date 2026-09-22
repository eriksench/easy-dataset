'use client';

export const LOCAL_DESTINATION = 'local';
export const DEPARTMENT_DESTINATION = 'department';

export function createDepartmentMetadata(overrides = {}) {
  return {
    fileName: '',
    fileTitle: '',
    secretLevel: '内部',
    keywords: '',
    summary: '',
    ...overrides
  };
}

export function downloadArtifact(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deliverArtifact({
  blob,
  fileName,
  projectId,
  artifactType,
  defaultTitle,
  destination = LOCAL_DESTINATION,
  departmentMetadata = {}
}) {
  if (destination !== DEPARTMENT_DESTINATION) {
    downloadArtifact(blob, fileName);
    return { destination: LOCAL_DESTINATION, fileName };
  }

  const resolvedFileName = departmentMetadata.fileName?.trim() || fileName;
  const metadata = {
    fileName: resolvedFileName,
    fileTitle: departmentMetadata.fileTitle?.trim() || defaultTitle || resolvedFileName,
    secretLevel: departmentMetadata.secretLevel?.trim() || '内部',
    keywords: departmentMetadata.keywords?.trim() || '',
    summary: departmentMetadata.summary?.trim() || '',
    projectId: String(projectId || ''),
    artifactType
  };

  const formData = new FormData();
  formData.append('file', new File([blob], resolvedFileName, { type: blob.type || 'application/octet-stream' }));
  formData.append('metadata', JSON.stringify(metadata));

  const response = await fetch('/api/integrations/know-hub/depart-files/upload', {
    method: 'POST',
    body: formData
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || '上传至部门文档库失败');
  }
  return { destination: DEPARTMENT_DESTINATION, ...result };
}

export function mimeTypeForExtension(extension) {
  const normalized = String(extension || '')
    .replace(/^\./, '')
    .toLowerCase();
  return (
    {
      json: 'application/json',
      jsonl: 'application/x-ndjson',
      csv: 'text/csv;charset=utf-8',
      txt: 'text/plain;charset=utf-8',
      md: 'text/markdown;charset=utf-8',
      zip: 'application/zip'
    }[normalized] || 'application/octet-stream'
  );
}

export function departmentUploadSuccessMessage(result) {
  return result?.fileIdentifier
    ? `已上传至部门文档库（文件标识：${result.fileIdentifier}）`
    : '已上传至部门文档库';
}
