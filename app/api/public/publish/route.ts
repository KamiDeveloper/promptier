// POST /api/public/publish — publish a prompt snapshot to the public feed
// Requires: authenticated + nickname set
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/neon'
import { requireAuth } from '@/lib/auth/requireAuth'
import { z } from 'zod'
import { isRateLimited, rateLimitKey } from '@/lib/rateLimit'
import { normalizeModelValue } from '@/lib/models/modelTargets'

const PublishBodySchema = z.object({
  promptId: z.string().min(1).optional(),  // local_id of the source prompt
  title:       z.string().min(1).max(200),
  description: z.string().max(500).optional().default(''),
  content:     z.string().min(1).max(20000),
  contentType: z.enum(['text', 'json', 'markdown']).default('text'),
  type:        z.enum(['image_generation', 'image_editing', 'other']).default('other'),
  model:       z.string().trim().min(1).max(80).transform(normalizeModelValue),
  tags:        z.array(z.string().min(1).max(40)).max(10).default([]),
  optimizedImageUrl: z.string().startsWith('data:image/').max(3_000_000).optional(),
})

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes
  if (isRateLimited(rateLimitKey('public-publish', userId, req.headers.get('x-forwarded-for')), 10, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas publicaciones en poco tiempo.' }, { status: 429 })
  }

  // Require nickname
  const profileRows = await sql`
    SELECT nickname FROM profiles WHERE auth_user_id = ${userId} LIMIT 1
  `
  if (profileRows.length === 0 || !profileRows[0].nickname) {
    return NextResponse.json(
      { error: 'Debes configurar un nickname antes de publicar.' },
      { status: 403 }
    )
  }
  const authorNickname = profileRows[0].nickname as string

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = PublishBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const data = parsed.data

  // Find source prompt id if provided
  let sourcePk: string | null = null
  if (data.promptId) {
    const rows = await sql`
      SELECT id FROM prompts WHERE local_id = ${data.promptId} AND auth_user_id = ${userId} LIMIT 1
    `
    if (rows.length > 0) sourcePk = rows[0].id as string
  }

  const inserted = await sql`
    INSERT INTO public_prompts (
      source_prompt_id, author_user_id, author_nickname,
      title, description, content, content_type, type, model, tags, optimized_image_url
    )
    VALUES (
      ${sourcePk}, ${userId}, ${authorNickname},
      ${data.title}, ${data.description}, ${data.content},
      ${data.contentType}, ${data.type}, ${data.model}, ${data.tags}, ${data.optimizedImageUrl ?? null}
    )
    RETURNING id, published_at
  `

  return NextResponse.json({
    id: inserted[0].id,
    publishedAt: inserted[0].published_at,
    authorNickname,
  })
}
