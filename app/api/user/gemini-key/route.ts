import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { normalizeAiError } from '@/lib/services/aiErrors'
import { deleteGeminiKey, saveGeminiKey } from '@/lib/services/userAiKeyService'
import { getUserAiSettings } from '@/lib/services/userAiSettingsService'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > 2048) {
    return NextResponse.json({ error: 'Solicitud demasiado grande' }, { status: 413 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const apiKey = (body as Record<string, unknown>)?.apiKey
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return NextResponse.json({ error: 'apiKey requerida' }, { status: 422 })
  }

  try {
    await saveGeminiKey(userId, apiKey)
    return NextResponse.json(await getUserAiSettings(userId), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const normalized = normalizeAiError(err)
    return NextResponse.json(normalized.body, { status: normalized.status })
  }
}

export async function DELETE(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  await deleteGeminiKey(userId)
  return NextResponse.json(await getUserAiSettings(userId), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
