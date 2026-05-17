// GET /api/public/recent — returns metadata about recent public prompts
// Used by the "Ver si hay prompts recientes" button.
// Returns metadata and up to 25 prompts newer than the provided newest cursor.
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/neon'
import { getCurrentUserId } from '@/lib/auth/requireAuth'

export async function GET(req: NextRequest) {
  const viewerUserId = await getCurrentUserId(req)
  const { searchParams } = req.nextUrl
  const cursorRaw = searchParams.get('cursor')
  const [cursorTsRaw, cursorIdRaw] = cursorRaw?.split('|') ?? []
  const cursor = cursorTsRaw ? new Date(cursorTsRaw) : new Date(0)
  const cursorId = cursorIdRaw ?? '00000000-0000-0000-0000-000000000000'

  const countRows = await sql`
    SELECT COUNT(*) as count
    FROM public_prompts
    WHERE is_deleted = FALSE
      AND (
        published_at > ${cursor.toISOString()}
        OR (published_at = ${cursor.toISOString()} AND id > ${cursorId})
      )
  `

  const newestRows = await sql`
    SELECT id, published_at
    FROM public_prompts
    WHERE is_deleted = FALSE
    ORDER BY published_at DESC, id DESC
    LIMIT 1
  `

  const promptRows = await sql`
    SELECT
      id,
      author_user_id,
      author_nickname,
      title,
      description,
      content,
      content_type,
      type,
      model,
      tags,
      optimized_image_url,
      published_at
    FROM public_prompts
    WHERE is_deleted = FALSE
      AND (
        published_at > ${cursor.toISOString()}
        OR (published_at = ${cursor.toISOString()} AND id > ${cursorId})
      )
    ORDER BY published_at DESC, id DESC
    LIMIT 25
  `

  const count = parseInt(String(countRows[0]?.count ?? '0'), 10)
  const newest = newestRows[0]

  return NextResponse.json({
    count,
    hasNew: count > 0,
    newestPublishedAt: newest ? new Date(newest.published_at as string).toISOString() : null,
    newestId: newest?.id ?? null,
    prompts: promptRows.map((r) => ({
      id: r.id,
      authorNickname: r.author_nickname,
      title: r.title,
      description: r.description,
      content: r.content,
      contentType: r.content_type,
      type: r.type,
      model: r.model,
      tags: r.tags,
      optimizedImageUrl: r.optimized_image_url ?? undefined,
      ownedByViewer: viewerUserId ? r.author_user_id === viewerUserId : false,
      publishedAt: new Date(r.published_at as string).toISOString(),
      cursorValue: `${new Date(r.published_at as string).toISOString()}|${r.id}`,
    })),
  })
}
