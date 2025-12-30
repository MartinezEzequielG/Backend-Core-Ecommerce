import * as crypto from 'crypto';

export function verifySignatureMP(req: any, secret: string): boolean {
  const signature = req.headers['x-signature'] || req.headers['x-signature-hmac-sha256'];
  if (!signature) return false;
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return signature === expected;
}