import { FILE } from '@/constant';

const DEPARTMENT_NAME = '信息中心';
const DEFAULT_BASE_URL = 'http://localhost:8080/jeecg-boot';

function getBaseUrl() {
  return (process.env.KNOW_HUB_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getHeaders(headers = {}) {
  const token = process.env.KNOW_HUB_INTEGRATION_TOKEN;
  return token ? { ...headers, 'X-Integration-Token': token } : headers;
}

async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getUpstreamError(response) {
  try {
    const body = await response.text();
    return body || response.statusText;
  } catch (error) {
    return response.statusText;
  }
}

function decodeFileName(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch (error) {
    return value;
  }
}

function parseContentDisposition(value) {
  if (!value) return '';
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeFileName(utf8Match[1].replace(/^"|"$/g, ''));
  const basicMatch = value.match(/filename="?([^";]+)"?/i);
  return basicMatch ? basicMatch[1] : '';
}

export async function searchDepartmentFiles({ fileName = '', secretLevel = '', pageNo = 1, pageSize = 10 }) {
  const response = await fetchWithTimeout(`${getBaseUrl()}/searchDepartFiles`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      departName: DEPARTMENT_NAME,
      fileName: fileName.trim() || undefined,
      secretLevel: secretLevel.trim() || undefined,
      pageNo,
      pageSize
    })
  });

  if (!response.ok) {
    throw new Error(`Know Hub query failed (${response.status}): ${await getUpstreamError(response)}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(data.message || 'Know Hub query failed');
  }
  return data;
}

export async function downloadDepartmentFile(fileIdentifier) {
  const url = new URL(`${getBaseUrl()}/departFiles/${encodeURIComponent(fileIdentifier)}/content`);
  url.searchParams.set('departName', DEPARTMENT_NAME);
  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: getHeaders()
    },
    120000
  );

  if (!response.ok) {
    throw new Error(`Know Hub download failed (${response.status}): ${await getUpstreamError(response)}`);
  }

  const encodedFileName = response.headers.get('x-file-name');
  const contentDispositionName = parseContentDisposition(response.headers.get('content-disposition'));
  const fileName = decodeFileName(encodedFileName) || contentDispositionName || fileIdentifier;
  const extension = response.headers.get('x-file-extension') || '';
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > FILE.MAX_FILE_SIZE) {
    throw new Error(`File exceeds the ${FILE.MAX_FILE_SIZE / 1024 / 1024} MiB limit`);
  }

  const chunks = [];
  let totalBytes = 0;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Know Hub returned an empty file stream');
  }
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > FILE.MAX_FILE_SIZE) {
      await reader.cancel('File size limit exceeded');
      throw new Error(`File exceeds the ${FILE.MAX_FILE_SIZE / 1024 / 1024} MiB limit`);
    }
    chunks.push(Buffer.from(value));
  }
  const content = Buffer.concat(chunks, totalBytes);

  return { fileName, extension, content };
}

export { DEPARTMENT_NAME };
