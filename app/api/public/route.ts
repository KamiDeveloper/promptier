// GET /api/public — returns paginated public prompts (max 25 per page, keyset pagination)
// No authentication required — public read.
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/neon'
import { getCurrentUserId } from '@/lib/auth/requireAuth'
import { PublicFeedResponseSchema } from '@/lib/schemas/sync'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const viewerUserId = await getCurrentUserId(req)
  const { searchParams } = req.nextUrl
  const cursorRaw = searchParams.get('cursor')   // ISO timestamp|uuid
  const [cursorTsRaw, cursorIdRaw] = cursorRaw?.split('|') ?? []
  const cursor = cursorTsRaw ? new Date(cursorTsRaw) : new Date()
  const cursorId = cursorIdRaw ?? 'ffffffff-ffff-ffff-ffff-ffffffffffff'

  const rows = await sql`
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
        published_at < ${cursor.toISOString()}
        OR (published_at = ${cursor.toISOString()} AND id < ${cursorId})
      )
    ORDER BY published_at DESC, id DESC
    LIMIT ${PAGE_SIZE}
  `

  const nextCursor =
    rows.length === PAGE_SIZE
      ? `${new Date(rows[rows.length - 1].published_at as string).toISOString()}|${rows[rows.length - 1].id as string}`
      : null

  const response = PublicFeedResponseSchema.parse({
    prompts: rows.map((r) => ({
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
    nextCursor,
    hasMore: nextCursor !== null,
  })

  return NextResponse.json(response)
}
