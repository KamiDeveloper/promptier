// DOMPurify wrapper — only runs in browser context
// Server Components must not call this; use plain text rendering instead.
import type DOMPurifyType from 'dompurify'

type DOMPurifyInstance = typeof DOMPurifyType

let _purify: DOMPurifyInstance | null = null

async function getPurify(): Promise<DOMPurifyInstance | null> {
  if (_purify) return _purify
  if (typeof window === 'undefined') return null
  const mod = await import('dompurify')
  // DOMPurify can export as default or as the module itself
  _purify = (mod.default ?? mod) as unknown as DOMPurifyInstance
  return _purify
}

/**
 * Sanitize an HTML string (e.g. rendered Markdown).
 * Strips script tags and event handlers.
 * Spec: security-performance — "Markdown shall be sanitized"
 */
export async function sanitizeHtml(dirty: string): Promise<string> {
  const purify = await getPurify()
  if (!purify) {
    // Server-side: return empty string to be safe
    return ''
  }
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'a', 'hr',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORCE_BODY: true,
  }) as string
}
