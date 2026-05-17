// POST /api/ai/extract — extract prompt from a screenshot image
// Body: { imageDataUrl: string } — base64 data URL (WebP/JPEG/PNG)
import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { extractFromScreenshot } from '@/lib/services/aiService'
import { normalizeAiError } from '@/lib/services/aiErrors'

// Max payload: 2MB (base64 of ~1.5MB optimized image)
const MAX_BODY_SIZE = 2 * 1024 * 1024

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  // Size guard
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Imagen demasiado grande (máx 2MB)' }, { status: 413 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const imageDataUrl = (body as Record<string, unknown>)?.imageDataUrl
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'imageDataUrl requerido (data URL de imagen)' }, { status: 422 })
  }

  try {
    const result = await extractFromScreenshot({ userId }, imageDataUrl)
    return NextResponse.json(result)
  } catch (err) {
    const normalized = normalizeAiError(err)
    return NextResponse.json(normalized.body, {
      status: normalized.status,
      headers: normalized.retryAfterSeconds ? { 'Retry-After': String(normalized.retryAfterSeconds) } : undefined,
    })
  }
}
