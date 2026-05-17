// GET /api/sync/images/pull - fetches optimized prompt images updated after cursor.
// Original uploads are local-only and are never returned by this endpoint.
import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { sql } from '@/lib/db/neon'

export async function GET(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  const { searchParams } = req.nextUrl
  const cursor = searchParams.get('cursor')
  const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50), 100)
  const cursorTs = cursor ? new Date(cursor) : new Date(0)

  if (Number.isNaN(cursorTs.getTime())) {
    return NextResponse.json({ error: 'Cursor invalido' }, { status: 422 })
  }

  try {
    const rows = await sql`
      SELECT
        pi.id,
        pi.local_id,
        p.local_id AS prompt_local_id,
        pi.data_url,
        pi.sha256,
        pi.width,
        pi.height,
        pi.format,
        pi.created_at,
        pi.updated_at,
        pi.is_deleted
      FROM prompt_images pi
      INNER JOIN prompts p ON p.id = pi.prompt_id
      WHERE pi.auth_user_id = ${userId}
        AND pi.local_id IS NOT NULL
        AND pi.updated_at > ${cursorTs.toISOString()}
      ORDER BY pi.updated_at ASC
      LIMIT ${limit}
    `

    const nextCursor = rows.length > 0
      ? new Date(rows[rows.length - 1].updated_at as string).toISOString()
      : cursor ?? new Date(0).toISOString()

    return NextResponse.json({
      images: rows.map((row) => {
        const updatedAt = new Date(row.updated_at as string).toISOString()
        const isDeleted = Boolean(row.is_deleted)

        return {
          localId: row.local_id,
          remoteId: row.id,
          promptLocalId: row.prompt_local_id,
          dataUrl: isDeleted ? undefined : row.data_url,
          sha256: row.sha256 || undefined,
          mimeType: row.format || 'image/webp',
          width: row.width === null ? undefined : Number(row.width),
          height: row.height === null ? undefined : Number(row.height),
          createdAt: new Date(row.created_at as string).toISOString(),
          updatedAt,
          deletedAt: isDeleted ? updatedAt : undefined,
        }
      }),
      nextCursor,
      hasMore: rows.length === limit,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'No se pudieron descargar las imagenes sincronizadas.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
