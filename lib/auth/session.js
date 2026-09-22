const SESSION_COOKIE_NAME = 'easy_dataset_session';
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getSecret() {
  const secret = process.env.EASY_DATASET_SESSION_SECRET || '';
  if (secret.length < 32) {
    throw new Error('EASY_DATASET_SESSION_SECRET must contain at least 32 characters');
  }
  return secret;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function encryptionKey() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getSecret()));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealSession(session, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const payload = new TextEncoder().encode(
    JSON.stringify({ ...session, issuedAt: now, expiresAt: now + Math.min(maxAgeSeconds, SESSION_MAX_AGE_SECONDS) })
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), payload);
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

export async function unsealSession(value) {
  if (!value) return null;
  try {
    const [version, encodedIv, encodedPayload] = value.split('.');
    if (version !== 'v1' || !encodedIv || !encodedPayload) return null;
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(encodedIv) },
      await encryptionKey(),
      base64UrlToBytes(encodedPayload)
    );
    const session = JSON.parse(new TextDecoder().decode(decrypted));
    if (!session?.user || !session?.accessToken || !session?.expiresAt) return null;
    if (session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request) {
  return unsealSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export function sessionCookieOptions(requestUrl, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const secure = new URL(requestUrl).protocol === 'https:';
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.min(maxAgeSeconds, SESSION_MAX_AGE_SECONDS)
  };
}

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
