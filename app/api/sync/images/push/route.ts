// POST /api/sync/images/push - uploads optimized prompt images only.
// Original uploads are local-only and are intentionally rejected by schema.
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/neon'
import { requireAuth } from '@/lib/auth/requireAuth'
import { isRateLimited, rateLimitKey } from '@/lib/rateLimit'
import { SyncImagePushRequestSchema } from '@/lib/schemas/sync'

const MAX_BODY_SIZE = 8 * 1024 * 1024

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes
  if (isRateLimited(rateLimitKey('sync-images-push', userId, req.headers.get('x-forwarded-for')), 60, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas subidas de imagenes en poco tiempo.' }, { status: 429 })
  }

  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Payload de imagenes demasiado grande.' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = SyncImagePushRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Esquema invalido', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const results: Array<{
    localId: string
    remoteId?: string
    status: 'applied' | 'skipped' | 'error'
    updatedAt?: string
    error?: string
  }> = []

  for (const image of parsed.data.images) {
    try {
      const updatedAt = image.updatedAt ?? new Date().toISOString()

      if (image.operation === 'delete') {
        const rows = await sql`
          UPDATE prompt_images
          SET is_deleted = TRUE,
              updated_at = ${updatedAt}
          WHERE auth_user_id = ${userId}
            AND local_id = ${image.localId}
          RETURNING id, updated_at
        `

        results.push({
          localId: image.localId,
          remoteId: rows[0]?.id as string | undefined,
          status: rows.length > 0 ? 'applied' : 'skipped',
          updatedAt: rows[0]?.updated_at ? new Date(rows[0].updated_at as string).toISOString() : updatedAt,
        })
        continue
      }

      const promptRows = await sql`
        SELECT id FROM prompts
        WHERE local_id = ${image.promptLocalId}
          AND auth_user_id = ${userId}
          AND is_deleted = FALSE
        LIMIT 1
      `

      if (promptRows.length === 0) {
        results.push({
          localId: image.localId,
          status: 'skipped',
          error: 'Prompt remoto no encontrado para esta imagen.',
        })
        continue
      }

      const promptId = promptRows[0].id as string
      const sizeBytes = Math.round((image.dataUrl.length * 3) / 4)
      const createdAt = image.createdAt ?? updatedAt
      const rows = await sql`
        INSERT INTO prompt_images (
          local_id, prompt_id, auth_user_id, image_type, data_url, sha256,
          width, height, format, size_bytes, created_at, updated_at, is_deleted
        )
        VALUES (
          ${image.localId}, ${promptId}, ${userId}, 'optimized', ${image.dataUrl}, ${image.sha256 ?? ''},
          ${image.width ?? null}, ${image.height ?? null}, ${image.mimeType}, ${sizeBytes},
          ${createdAt},
          ${updatedAt},
          FALSE
        )
        ON CONFLICT (auth_user_id, local_id)
        WHERE local_id IS NOT NULL
        DO UPDATE SET
          prompt_id = EXCLUDED.prompt_id,
          image_type = 'optimized',
          data_url = EXCLUDED.data_url,
          sha256 = EXCLUDED.sha256,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          format = EXCLUDED.format,
          size_bytes = EXCLUDED.size_bytes,
          updated_at = EXCLUDED.updated_at,
          is_deleted = FALSE
        RETURNING id, updated_at
      `

      results.push({
        localId: image.localId,
        remoteId: rows[0]?.id as string | undefined,
        status: 'applied',
        updatedAt: rows[0]?.updated_at ? new Date(rows[0].updated_at as string).toISOString() : undefined,
      })
    } catch (err) {
      results.push({
        localId: image.localId,
        status: 'error',
        error: err instanceof Error ? err.message : 'Error desconocido',
      })
    }
  }

  return NextResponse.json({
    results,
    summary: {
      applied: results.filter((result) => result.status === 'applied').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      errors: results.filter((result) => result.status === 'error').length,
    },
  })
}
