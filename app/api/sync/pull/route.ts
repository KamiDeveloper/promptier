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
  const legacyCursor = searchParams.get('cursor')    // Fallback legacy cursor
  const promptsCursor = searchParams.get('prompts_cursor') ?? legacyCursor
  const collectionsCursor = searchParams.get('collections_cursor') ?? legacyCursor
  const templatesCursor = searchParams.get('templates_cursor') ?? legacyCursor

  const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(1, limitRaw), 100)

  const pCursorTs = promptsCursor ? new Date(promptsCursor) : new Date(0)
  const cCursorTs = collectionsCursor ? new Date(collectionsCursor) : new Date(0)
  const tCursorTs = templatesCursor ? new Date(templatesCursor) : new Date(0)

  // Fetch prompts updated after promptsCursor
  const prompts = await sql`
    SELECT
      id, local_id, title, description, content, content_type, type, model,
      tags, is_favorite, order_index, copy_count, base_version, is_deleted,
      collection_id, created_at, updated_at, synced_at
    FROM prompts
    WHERE auth_user_id = ${userId}
      AND updated_at > ${pCursorTs.toISOString()}
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `

  // Fetch collections updated after collectionsCursor
  const collections = await sql`
    SELECT id, local_id, name, parent_id, is_deleted, created_at, updated_at
    FROM collections
    WHERE auth_user_id = ${userId}
      AND updated_at > ${cCursorTs.toISOString()}
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `

  const templates = await sql`
    SELECT id, local_id, name, content, content_type, tags, is_deleted, created_at, updated_at
    FROM templates
    WHERE auth_user_id = ${userId}
      AND updated_at > ${tCursorTs.toISOString()}
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `

  const nextPromptsCursor = prompts.length > 0
    ? new Date(prompts[prompts.length - 1].updated_at as string).toISOString()
    : promptsCursor ?? new Date(0).toISOString()

  const nextCollectionsCursor = collections.length > 0
    ? new Date(collections[collections.length - 1].updated_at as string).toISOString()
    : collectionsCursor ?? new Date(0).toISOString()

  const nextTemplatesCursor = templates.length > 0
    ? new Date(templates[templates.length - 1].updated_at as string).toISOString()
    : templatesCursor ?? new Date(0).toISOString()

  const nextCursor = new Date(
    Math.max(
      new Date(nextPromptsCursor).getTime(),
      new Date(nextCollectionsCursor).getTime(),
      new Date(nextTemplatesCursor).getTime()
    )
  ).toISOString()

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
    nextCursor: nextCursor,
    nextCursors: {
      prompts: nextPromptsCursor,
      collections: nextCollectionsCursor,
      templates: nextTemplatesCursor,
    },
    hasMore: prompts.length === limit || collections.length === limit || templates.length === limit,
  })
}
