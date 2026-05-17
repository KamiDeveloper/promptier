/**
 * Compute SHA-256 hash of an ArrayBuffer or string.
 * Returns hex string. Uses Web Crypto API (browser + Node.js 15+).
 */
export async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buffer =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data)

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
