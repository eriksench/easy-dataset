import path from 'path';
import { promises as fs } from 'fs';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { FILE } from '@/constant';
import { getProjectRoot, ensureDir } from '@/lib/db/base';
import { createUploadFileInfo } from '@/lib/db/upload-files';
import { getFileMD5 } from '@/lib/util/file';
import { processEpub } from '@/lib/file/file-process/epub';

export const SUPPORTED_SOURCE_EXTENSIONS = new Set(['pdf', 'md', 'txt', 'docx', 'epub']);

export class DocumentImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'DocumentImportError';
    this.status = status;
  }
}

export function normalizeExtension(extension = '') {
  return String(extension).trim().toLowerCase().replace(/^\./, '');
}

export function getFileExtension(fileName = '', fallback = '') {
  return normalizeExtension(path.extname(fileName)) || normalizeExtension(fallback);
}

export function sanitizeFileName(fileName) {
  const normalized = String(fileName || '')
    .replace(/\\/g, '/')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  const baseName = path.posix.basename(normalized);
  if (!baseName || baseName === '.' || baseName === '..') {
    throw new DocumentImportError('Invalid file name');
  }
  return baseName;
}

function replaceExtension(fileName, extension) {
  const parsed = path.parse(fileName);
  return `${parsed.name}.${extension}`;
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export async function normalizeDocument({ fileName, extension, content }) {
  const safeFileName = sanitizeFileName(fileName);
  const sourceExtension = getFileExtension(safeFileName, extension);
  if (!SUPPORTED_SOURCE_EXTENSIONS.has(sourceExtension)) {
    throw new DocumentImportError(`Unsupported file format: ${sourceExtension || 'unknown'}`);
  }
  if (!Buffer.isBuffer(content)) {
    content = Buffer.from(content);
  }
  if (content.length > FILE.MAX_FILE_SIZE) {
    throw new DocumentImportError(`File exceeds the ${FILE.MAX_FILE_SIZE / 1024 / 1024} MiB limit`, 413);
  }

  if (sourceExtension === 'pdf' || sourceExtension === 'md') {
    return { fileName: safeFileName, content };
  }
  if (sourceExtension === 'txt') {
    return { fileName: replaceExtension(safeFileName, 'md'), content: Buffer.from(content.toString('utf8')) };
  }
  if (sourceExtension === 'docx') {
    const htmlResult = await mammoth.convertToHtml({ buffer: content });
    const markdown = new TurndownService().turndown(htmlResult.value);
    return { fileName: replaceExtension(safeFileName, 'md'), content: Buffer.from(markdown, 'utf8') };
  }

  const markdown = await processEpub(toArrayBuffer(content));
  return { fileName: replaceExtension(safeFileName, 'md'), content: Buffer.from(markdown, 'utf8') };
}

export async function saveProjectDocument({ projectId, fileName, content }) {
  const safeFileName = sanitizeFileName(fileName);
  const extension = getFileExtension(safeFileName);
  if (extension !== 'md' && extension !== 'pdf') {
    throw new DocumentImportError('Only Markdown and PDF files can be persisted');
  }
  if (!Buffer.isBuffer(content)) {
    content = Buffer.from(content);
  }
  if (content.length > FILE.MAX_FILE_SIZE) {
    throw new DocumentImportError(`File exceeds the ${FILE.MAX_FILE_SIZE / 1024 / 1024} MiB limit`, 413);
  }

  const projectRoot = await getProjectRoot();
  const filesDir = path.join(projectRoot, projectId, 'files');
  await ensureDir(filesDir);
  const filePath = path.join(filesDir, safeFileName);
  const resolvedFilesDir = path.resolve(filesDir);
  const resolvedFilePath = path.resolve(filePath);
  if (path.dirname(resolvedFilePath) !== resolvedFilesDir) {
    throw new DocumentImportError('Invalid file path');
  }

  try {
    await fs.writeFile(filePath, content, { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new DocumentImportError(`A file named ${safeFileName} already exists`, 409);
    }
    throw error;
  }

  try {
    const stats = await fs.stat(filePath);
    const md5 = await getFileMD5(filePath);
    const fileInfo = await createUploadFileInfo({
      projectId,
      fileName: safeFileName,
      size: stats.size,
      md5,
      fileExt: path.extname(filePath),
      path: filesDir
    });

    return {
      message: 'File uploaded successfully',
      fileName: safeFileName,
      filePath,
      fileId: fileInfo.id
    };
  } catch (error) {
    await fs.unlink(filePath).catch(() => {});
    throw error;
  }
}
