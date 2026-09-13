/**
 * Generates a unique identifier using standard Web Crypto API (crypto.randomUUID)
 * with a fallback for older environments.
 */
export function generateId(prefix: string = ''): string {
  let uuid: string;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    uuid = crypto.randomUUID();
  } else {
    // Fallback: timestamp + pseudo-random components
    uuid = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
  }

  return prefix ? `${prefix}_${uuid}` : uuid;
}
