// POST /api/ai/score — compute quality score for a prompt
import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { scoreQuality } from '@/lib/services/aiService'
import { normalizeAiError } from '@/lib/services/aiErrors'

const MAX_CONTENT_LENGTH = 8000

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const content = (body as Record<string, unknown>)?.content
  if (typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'content requerido' }, { status: 422 })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: `content demasiado largo (máx ${MAX_CONTENT_LENGTH} chars)` }, { status: 422 })
  }

  try {
    const result = await scoreQuality({ userId }, content)
    return NextResponse.json(result)
  } catch (err) {
    const normalized = normalizeAiError(err)
    return NextResponse.json(normalized.body, {
      status: normalized.status,
      headers: normalized.retryAfterSeconds ? { 'Retry-After': String(normalized.retryAfterSeconds) } : undefined,
    })
  }
}
