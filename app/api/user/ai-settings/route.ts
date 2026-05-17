import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { normalizeAiError } from '@/lib/services/aiErrors'
import { getUserAiSettings } from '@/lib/services/userAiSettingsService'
import { isGeminiThinkingLevel, updateGeminiThinking } from '@/lib/services/userAiKeyService'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  const settings = await getUserAiSettings(userId)
  return NextResponse.json(settings, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function PATCH(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const thinkingLevel = (body as Record<string, unknown>)?.thinkingLevel
  if (!isGeminiThinkingLevel(thinkingLevel)) {
    return NextResponse.json({ error: 'thinkingLevel invalido' }, { status: 422 })
  }

  try {
    await updateGeminiThinking(userId, thinkingLevel)
    return NextResponse.json(await getUserAiSettings(userId), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const normalized = normalizeAiError(err)
    return NextResponse.json(normalized.body, { status: normalized.status })
  }
}
