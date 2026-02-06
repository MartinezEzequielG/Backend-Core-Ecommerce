export const MP_PROVIDER = 'mercadopago' as const;
export const MP_API_BASE = 'https://api.mercadopago.com' as const;

export function mpAccessToken(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error('MP_ACCESS_TOKEN no configurado');
  return t.trim();
}

/**
 * URL pública del backend (ngrok / EC2 / dominio).
 * Debe ser ABSOLUTA e idealmente https en prod.
 */
export function backendPublicUrl(): string {
  const raw = process.env.BACKEND_PUBLIC_URL || 'http://localhost:3001';
  return raw.trim().replace(/\/+$/, '');
}

/**
 * URL pública del store (para redirects finales).
 * En tu flujo actual, el redirect lo hace el BACKEND hacia el store,
 * así que esto se usa solo si querés armar back_urls directo al store.
 */
export function storePublicUrl(): string {
  const raw = process.env.STORE_PUBLIC_URL || 'http://localhost:3002';
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Para demo/dev: usar sandbox_init_point siempre.
 * En prod: init_point.
 */
export function mpPreferSandbox(): boolean {
  return (process.env.MP_ENV || '').toLowerCase() === 'sandbox' || process.env.NODE_ENV !== 'production';
}
