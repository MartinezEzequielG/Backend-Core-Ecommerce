import * as crypto from 'crypto';

function parseSig(v: string): { ts?: string; v1?: string } {
  const out: any = {};
  for (const part of String(v || '').split(',')) {
    const [k, val] = part.split('=').map((s) => s.trim());
    if (k && val) out[k] = val;
  }
  return out as { ts?: string; v1?: string };
}

function hmac(secret: string, payload: string): Buffer {
  return crypto.createHmac('sha256', secret).update(payload).digest();
}

function timingEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function decodeSig(v1: string): Buffer | null {
  try {
    const hex = Buffer.from(v1, 'hex');
    if (hex.length === 32) return hex;
  } catch {}
  try {
    const b64 = Buffer.from(v1, 'base64');
    if (b64.length === 32) return b64;
  } catch {}
  return null;
}

function extractPaymentIdFromRaw(rawBody?: string): string | null {
  if (!rawBody) return null;
  try {
    const evt = JSON.parse(rawBody);
    const id =
      evt?.data?.id ??
      evt?.id ??
      evt?.payment_id ??
      (typeof evt?.resource === 'string' ? evt.resource.split('/').pop() : null);
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

export function verifySignatureMP(req: any, secret: string, rawBody?: string): boolean {
  // ✅ DEV: no bloquear
  if (process.env.NODE_ENV !== 'production') return true;

  const sigHeader = req.headers?.['x-signature'] || req.headers?.['x-signature-hmac-sha256'];
  const requestId = String(req.headers?.['x-request-id'] || '');

  if (!sigHeader) return false;

  const { ts, v1 } = parseSig(String(sigHeader));
  if (!v1) return false;

  const provided = decodeSig(v1);
  if (!provided) return false;

  if (ts) {
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    const maxSkewSec = 5 * 60;
    if (Math.abs(nowSec - tsNum) > maxSkewSec) return false;
  }

  const paymentId = extractPaymentIdFromRaw(rawBody);
  if (ts && requestId && paymentId) {
    const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
    const expected = hmac(secret, manifest);
    if (timingEqual(provided, expected)) return true;
  }

  if (rawBody) {
    const expected = hmac(secret, rawBody);
    if (timingEqual(provided, expected)) return true;
  }

  return false;
}
