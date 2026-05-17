// POST /api/ai/translate - translate prompt content to Spanish
import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { translatePromptToSpanish } from '@/lib/services/aiService'
import { normalizeAiError } from '@/lib/services/aiErrors'

const MAX_CONTENT_LENGTH = 8000

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const content = (body as Record<string, unknown>)?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'content requerido' }, { status: 422 })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: `content demasiado largo (max ${MAX_CONTENT_LENGTH} chars)` }, { status: 422 })
  }

  try {
    return NextResponse.json(await translatePromptToSpanish({ userId }, content))
  } catch (err) {
    const normalized = normalizeAiError(err)
    return NextResponse.json(normalized.body, {
      status: normalized.status,
      headers: normalized.retryAfterSeconds ? { 'Retry-After': String(normalized.retryAfterSeconds) } : undefined,
    })
  }
}
