// GET /api/sync/pull — fetches server-side prompts/collections updated after cursor
// Requires: authenticated session.
// Query params: cursor (ISO timestamp), limit (default 50, max 100)
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/neon'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function GET(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  const { searchParams } = req.nextUrl
  const cursor = searchParams.get('cursor')    // ISO timestamp
  const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, limitRaw), 100)

  const cursorTs = cursor ? new Date(cursor) : new Date(0)

  // Fetch prompts updated after cursor
  const prompts = await sql`
    SELECT
      id, local_id, title, description, content, content_type, type, model,
      tags, is_favorite, order_index, copy_count, base_version, is_deleted,
      collection_id, created_at, updated_at, synced_at
    FROM prompts
    WHERE auth_user_id = ${userId}
      AND updated_at > ${cursorTs.toISOString()}
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `

  // Fetch collections updated after cursor
  const collections = await sql`
    SELECT id, local_id, name, parent_id, is_deleted, created_at, updated_at
    FROM collections
    WHERE auth_user_id = ${userId}
      AND updated_at > ${cursorTs.toISOString()}
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `

  const templates = await sql`
    SELECT id, local_id, name, content, content_type, tags, is_deleted, created_at, updated_at
    FROM templates
    WHERE auth_user_id = ${userId}
      AND updated_at > ${cursorTs.toISOString()}
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `

  // New cursor = max updated_at across all returned rows
  const allTs = [
    ...prompts.map((r) => new Date(r.updated_at as string).getTime()),
    ...collections.map((r) => new Date(r.updated_at as string).getTime()),
    ...templates.map((r) => new Date(r.updated_at as string).getTime()),
  ]
  const newCursor =
    allTs.length > 0
      ? new Date(Math.max(...allTs)).toISOString()
      : cursor ?? new Date(0).toISOString()

  return NextResponse.json({
    prompts: prompts.map((r) => ({
      localId: r.local_id,
      remoteId: r.id,
      title: r.title,
      description: r.description,
      content: r.content,
      contentType: r.content_type,
      type: r.type,
      model: r.model,
      tags: r.tags,
      isFavorite: r.is_favorite,
      orderIndex: Number(r.order_index ?? 0),
      collectionId: null,
      syncStatus: r.is_deleted ? 'pending_delete' : 'synced',
      baseVersion: r.base_version,
      remoteVersion: r.base_version,
      copyCount: r.copy_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.is_deleted ? r.updated_at : undefined,
    })),
    collections: collections
      .filter((r) => !r.is_deleted)
      .map((r) => ({
        localId: r.local_id,
        remoteId: r.id,
        name: r.name,
        parentId: null,
        syncStatus: 'synced',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    templates: templates
      .filter((r) => !r.is_deleted)
      .map((r) => ({
        localId: r.local_id,
        remoteId: r.id,
        name: r.name,
        content: r.content,
        contentType: r.content_type,
        tags: r.tags,
        syncStatus: 'synced',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    nextCursor: newCursor,
    hasMore: prompts.length === limit || collections.length === limit || templates.length === limit,
  })
}
