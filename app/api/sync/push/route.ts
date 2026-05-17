// POST /api/sync/push — uploads local outbox operations to Neon DB
// Validates with SyncPushRequestSchema, idempotent via operationId.
// Requires: authenticated session.
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/neon'
import { requireAuth } from '@/lib/auth/requireAuth'
import { SyncPushRequestSchema } from '@/lib/schemas/sync'
import { isRateLimited, rateLimitKey } from '@/lib/rateLimit'

// Max payload size: 256KB
const MAX_BODY_SIZE = 256 * 1024

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes
  if (isRateLimited(rateLimitKey('sync-push', userId, req.headers.get('x-forwarded-for')), 20, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes de sync.' }, { status: 429 })
  }

  // Size guard
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Payload demasiado grande (máx 256KB)' }, { status: 413 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = SyncPushRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Esquema inválido', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { operations } = parsed.data
  const results: Array<{
    operationId: string
    entityType?: 'prompt' | 'collection' | 'template'
    entityLocalId?: string
    remoteId?: string
    remoteVersion?: number
    status: 'applied' | 'skipped' | 'error'
    error?: string
  }> = []

  for (const op of operations) {
    const { operationId, entityType, operation, payload } = op

    // Idempotency check
    const existing = await sql`
      SELECT 1 FROM sync_operations
      WHERE operation_id = ${operationId} AND auth_user_id = ${userId}
      LIMIT 1
    `
    if (existing.length > 0) {
      results.push({ operationId, entityType, entityLocalId: op.entityLocalId, status: 'skipped' })
      continue
    }

    try {
      let remoteId: string | undefined
      let remoteVersion: number | undefined

      if (entityType === 'prompt') {
        if (operation === 'upsert') {
          const p = payload as Record<string, unknown>
          const rows = await sql`
            INSERT INTO prompts (
              local_id, auth_user_id, title, description, content,
              content_type, type, model, tags, is_favorite, order_index, copy_count,
              base_version, is_deleted, collection_id, created_at, updated_at
            ) VALUES (
              ${p.localId as string}, ${userId},
              ${(p.title as string) ?? ''},
              ${(p.description as string) ?? ''},
              ${(p.content as string) ?? ''},
              ${(p.contentType as string) ?? 'text'},
              ${(p.type as string) ?? 'other'},
              ${(p.model as string) ?? ''},
              ${(p.tags as string[]) ?? []},
              ${(p.isFavorite as boolean) ?? false},
              ${(p.orderIndex as number) ?? 0},
              ${(p.copyCount as number) ?? 0},
              ${(p.baseVersion as number) ?? 1},
              ${(p.isDeleted as boolean) ?? false},
              (SELECT id FROM collections WHERE local_id = ${(p.collectionId as string | null) ?? ''} AND auth_user_id = ${userId} LIMIT 1),
              ${(p.createdAt as string) ?? new Date().toISOString()},
              ${(p.updatedAt as string) ?? new Date().toISOString()}
            )
            ON CONFLICT (local_id, auth_user_id)
            DO UPDATE SET
              title        = EXCLUDED.title,
              description  = EXCLUDED.description,
              content      = EXCLUDED.content,
              content_type = EXCLUDED.content_type,
              type         = EXCLUDED.type,
              model        = EXCLUDED.model,
              tags         = EXCLUDED.tags,
              is_favorite  = EXCLUDED.is_favorite,
              order_index  = EXCLUDED.order_index,
              copy_count   = GREATEST(prompts.copy_count, EXCLUDED.copy_count),
              base_version = GREATEST(prompts.base_version, EXCLUDED.base_version),
              is_deleted   = EXCLUDED.is_deleted,
              collection_id = EXCLUDED.collection_id,
              updated_at   = EXCLUDED.updated_at,
              synced_at    = NOW()
            WHERE prompts.base_version <= EXCLUDED.base_version
            RETURNING id, base_version
          `
          remoteId = rows[0]?.id as string | undefined
          remoteVersion = rows[0]?.base_version as number | undefined
        } else if (operation === 'delete') {
          const p = payload as Record<string, unknown>
          const rows = await sql`
            UPDATE prompts SET is_deleted = TRUE, updated_at = NOW(), synced_at = NOW()
            WHERE local_id = ${p.localId as string} AND auth_user_id = ${userId}
            RETURNING id, base_version
          `
          remoteId = rows[0]?.id as string | undefined
          remoteVersion = rows[0]?.base_version as number | undefined
        }
      } else if (entityType === 'collection') {
        if (operation === 'upsert') {
          const p = payload as Record<string, unknown>
          const rows = await sql`
            INSERT INTO collections (local_id, auth_user_id, name, parent_id, is_deleted, created_at, updated_at)
            VALUES (
              ${p.localId as string}, ${userId},
              ${(p.name as string) ?? ''},
              (SELECT id FROM collections WHERE local_id = ${(p.parentId as string | null) ?? ''} AND auth_user_id = ${userId} LIMIT 1),
              ${(p.isDeleted as boolean) ?? false},
              ${(p.createdAt as string) ?? new Date().toISOString()},
              ${(p.updatedAt as string) ?? new Date().toISOString()}
            )
            ON CONFLICT (local_id, auth_user_id)
            DO UPDATE SET
              name       = EXCLUDED.name,
              parent_id  = EXCLUDED.parent_id,
              is_deleted = EXCLUDED.is_deleted,
              updated_at = EXCLUDED.updated_at
            RETURNING id
          `
          remoteId = rows[0]?.id as string | undefined
        } else if (operation === 'delete') {
          const p = payload as Record<string, unknown>
          const rows = await sql`
            UPDATE collections SET is_deleted = TRUE, updated_at = NOW()
            WHERE local_id = ${p.localId as string} AND auth_user_id = ${userId}
            RETURNING id
          `
          remoteId = rows[0]?.id as string | undefined
        }
      } else if (entityType === 'template') {
        const p = payload as Record<string, unknown>
        if (operation === 'upsert') {
          const rows = await sql`
            INSERT INTO templates (local_id, auth_user_id, name, content, content_type, tags, is_deleted, created_at, updated_at)
            VALUES (
              ${p.localId as string}, ${userId},
              ${(p.name as string) ?? ''},
              ${(p.content as string) ?? ''},
              ${(p.contentType as string) ?? 'text'},
              ${(p.tags as string[]) ?? []},
              FALSE,
              ${(p.createdAt as string) ?? new Date().toISOString()},
              ${(p.updatedAt as string) ?? new Date().toISOString()}
            )
            ON CONFLICT (local_id, auth_user_id)
            DO UPDATE SET
              name = EXCLUDED.name,
              content = EXCLUDED.content,
              content_type = EXCLUDED.content_type,
              tags = EXCLUDED.tags,
              is_deleted = FALSE,
              updated_at = EXCLUDED.updated_at
            RETURNING id
          `
          remoteId = rows[0]?.id as string | undefined
        } else if (operation === 'delete') {
          const rows = await sql`
            UPDATE templates SET is_deleted = TRUE, updated_at = NOW()
            WHERE local_id = ${p.localId as string} AND auth_user_id = ${userId}
            RETURNING id
          `
          remoteId = rows[0]?.id as string | undefined
        }
      }

      // Record operation as applied
      await sql`
        INSERT INTO sync_operations (operation_id, auth_user_id, entity_type, operation)
        VALUES (${operationId}, ${userId}, ${entityType}, ${operation})
        ON CONFLICT (operation_id) DO NOTHING
      `
      results.push({
        operationId,
        entityType,
        entityLocalId: op.entityLocalId,
        remoteId,
        remoteVersion,
        status: 'applied',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      results.push({ operationId, status: 'error', error: msg })
    }
  }

  const applied = results.filter((r) => r.status === 'applied').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors  = results.filter((r) => r.status === 'error').length

  return NextResponse.json({ results, summary: { applied, skipped, errors } })
}
