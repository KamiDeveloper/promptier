// POST /api/ai/magic - guided AI prompt editing
import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { magicTouch } from '@/lib/services/aiService'
import { normalizeAiError } from '@/lib/services/aiErrors'

const MAX_CONTENT_LENGTH = 8000
const MAX_EDIT_REQUEST_LENGTH = 1200
const MAGIC_MODES = new Set(['edit', 'retry', 'iterate'])

type MagicMode = 'edit' | 'retry' | 'iterate'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const content = (body as Record<string, unknown>)?.content
  const editRequest = (body as Record<string, unknown>)?.editRequest
  const mode = (body as Record<string, unknown>)?.mode
  const previousResult = (body as Record<string, unknown>)?.previousResult

  if (typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'content requerido' }, { status: 422 })
  }
  if (typeof editRequest !== 'string' || editRequest.trim().length < 4) {
    return NextResponse.json({ error: 'editRequest requerido' }, { status: 422 })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: `content demasiado largo (max ${MAX_CONTENT_LENGTH} chars)` }, { status: 422 })
  }
  if (editRequest.length > MAX_EDIT_REQUEST_LENGTH) {
    return NextResponse.json({ error: `editRequest demasiado largo (max ${MAX_EDIT_REQUEST_LENGTH} chars)` }, { status: 422 })
  }
  if (typeof mode === 'string' && !MAGIC_MODES.has(mode)) {
    return NextResponse.json({ error: 'mode invalido' }, { status: 422 })
  }

  try {
    const result = await magicTouch(
      { userId },
      content,
      editRequest,
      typeof mode === 'string' ? mode as MagicMode : 'edit',
      typeof previousResult === 'string' ? previousResult : undefined,
    )
    return NextResponse.json(result)
  } catch (err) {
    const normalized = normalizeAiError(err)
    return NextResponse.json(normalized.body, {
      status: normalized.status,
      headers: normalized.retryAfterSeconds ? { 'Retry-After': String(normalized.retryAfterSeconds) } : undefined,
    })
  }
}
