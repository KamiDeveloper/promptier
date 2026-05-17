// Sync service — client-side manual sync with Neon DB
// Triggered manually by the user. Never runs automatically.
// Reads from the local outbox (Dexie) and pushes to /api/sync/push.
// Then pulls remote changes from /api/sync/pull and applies them locally.
import { getDb } from '@/lib/db/database'
import {
  getPendingItems,
  markDone,
  markFailed,
  countPending,
} from '@/lib/db/repositories/syncOutboxRepository'
import {
  getPromptByLocalId,
} from '@/lib/db/repositories/promptRepository'
import type { LocalCollection, LocalPrompt, LocalTemplate } from '@/lib/db/schema'

export type SyncResult = {
  pushed: number
  pulled: number
  conflicts: number
  errors: string[]
}

/**
 * Reads the last pull cursor from local settings.
 */
async function getLastCursor(): Promise<string | null> {
  const db = getDb()
  const setting = await db.userSettings.where('key').equals('sync_cursor').first()
  return (setting?.value as string) ?? null
}

/**
 * Saves the pull cursor to local settings.
 */
async function saveCursor(cursor: string): Promise<void> {
  const db = getDb()
  const existing = await db.userSettings.where('key').equals('sync_cursor').first()
  const setting = { key: 'sync_cursor', value: cursor, updatedAt: new Date() }

  if (existing?.id) {
    await db.userSettings.update(existing.id, setting)
  } else {
    await db.userSettings.add(setting)
  }
}

function normalizeRemotePrompt(remote: LocalPrompt): LocalPrompt {
  return {
    localId: remote.localId,
    remoteId: remote.remoteId,
    title: remote.title,
    content: remote.content,
    contentType: remote.contentType,
    description: remote.description,
    tags: remote.tags ?? [],
    type: remote.type,
    model: remote.model,
    isFavorite: remote.isFavorite,
    collectionId: remote.collectionId,
    syncStatus: 'synced',
    baseVersion: remote.baseVersion,
    remoteVersion: remote.remoteVersion,
    copyCount: remote.copyCount,
    lastCopiedAt: remote.lastCopiedAt ? new Date(remote.lastCopiedAt) : undefined,
    qualityScore: remote.qualityScore,
    aiTags: remote.aiTags,
    createdAt: new Date(remote.createdAt),
    updatedAt: new Date(remote.updatedAt),
    deletedAt: remote.deletedAt ? new Date(remote.deletedAt) : undefined,
  }
}

function normalizeRemoteCollection(remote: LocalCollection): LocalCollection {
  return {
    localId: remote.localId,
    remoteId: remote.remoteId,
    name: remote.name,
    parentId: remote.parentId,
    syncStatus: 'synced',
    createdAt: new Date(remote.createdAt),
    updatedAt: new Date(remote.updatedAt),
  }
}

function normalizeRemoteTemplate(remote: LocalTemplate): LocalTemplate {
  return {
    localId: remote.localId,
    remoteId: remote.remoteId,
    name: remote.name,
    content: remote.content,
    contentType: remote.contentType,
    tags: remote.tags ?? [],
    syncStatus: 'synced',
    createdAt: new Date(remote.createdAt),
    updatedAt: new Date(remote.updatedAt),
  }
}

/**
 * Performs a full manual sync cycle:
 * 1. Push all pending outbox operations
 * 2. Pull remote changes since last cursor
 * 3. Apply pulled changes to local IndexedDB (last-write-wins by baseVersion)
 */
export async function syncVault(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] }

  // ── 1. PUSH ───────────────────────────────────────────────────────────────
  const pending = await getPendingItems()

  if (pending.length > 0) {
    try {
      const operations = pending.map((item) => ({
        operationId: item.operationId,
        entityType: item.entityType,
        entityLocalId: item.entityLocalId,
        operation: item.operation,
        payload: JSON.parse(item.payload) as Record<string, unknown>,
      }))

      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err?.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as {
        results: Array<{
          operationId: string
          entityType?: 'prompt' | 'collection' | 'template'
          entityLocalId?: string
          remoteId?: string
          remoteVersion?: number
          status: string
          error?: string
        }>
      }

      const db = getDb()
      for (const r of data.results) {
        if (r.status === 'applied' || r.status === 'skipped') {
          await markDone(r.operationId)
          if (r.entityType === 'prompt' && r.entityLocalId) {
            await db.prompts.where('localId').equals(r.entityLocalId).modify({
              remoteId: r.remoteId,
              remoteVersion: r.remoteVersion,
              syncStatus: 'synced',
            })
          } else if (r.entityType === 'collection' && r.entityLocalId) {
            await db.collections.where('localId').equals(r.entityLocalId).modify({
              remoteId: r.remoteId,
              syncStatus: 'synced',
            })
          } else if (r.entityType === 'template' && r.entityLocalId) {
            await db.templates.where('localId').equals(r.entityLocalId).modify({
              remoteId: r.remoteId,
              syncStatus: 'synced',
            })
          }
          result.pushed++
        } else if (r.status === 'error') {
          await markFailed(r.operationId, r.error ?? 'Error desconocido')
          result.errors.push(`Push ${r.operationId}: ${r.error}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al hacer push'
      result.errors.push(`Push fallido: ${msg}`)
    }
  }

  // ── 2. PULL ───────────────────────────────────────────────────────────────
  try {
    const cursor = await getLastCursor()
    let url = '/api/sync/pull'
    if (cursor) url += `?cursor=${encodeURIComponent(cursor)}`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json() as { error?: string }
      throw new Error(err?.error ?? `HTTP ${res.status}`)
    }

    const data = await res.json() as {
      prompts: LocalPrompt[]
      collections: LocalCollection[]
      templates: LocalTemplate[]
      nextCursor: string
      hasMore: boolean
    }

    // Apply remote prompts to local DB
    const db = getDb()
    for (const remote of data.prompts) {
      try {
        const local = await getPromptByLocalId(remote.localId)
        const normalized = normalizeRemotePrompt(remote)

        if (!local) {
          // New remote prompt — insert locally (set syncStatus = synced)
          await db.prompts.add(normalized)
          result.pulled++
        } else if (remote.baseVersion > local.baseVersion) {
          // Remote is newer — apply (potential conflict resolved by version)
          if (remote.syncStatus !== 'pending_upload') {
            await db.prompts.put({ ...normalized, id: local.id })
            result.pulled++
          } else {
            await db.prompts.where('localId').equals(local.localId).modify({ syncStatus: 'conflict' })
            result.conflicts++
          }
        } else if (remote.baseVersion < local.baseVersion) {
          // Local is newer — skip (will be pushed in next sync)
          await db.prompts.where('localId').equals(local.localId).modify({ syncStatus: 'conflict' })
          result.conflicts++
        }
        // Same version → already in sync
      } catch (err) {
        result.errors.push(`Pull prompt ${remote.localId}: ${String(err)}`)
      }
    }

    for (const remote of data.collections ?? []) {
      const db = getDb()
      const local = await db.collections.where('localId').equals(remote.localId).first()
      const normalized = normalizeRemoteCollection(remote)
      if (!local) {
        await db.collections.add(normalized)
        result.pulled++
      } else {
        await db.collections.put({ ...normalized, id: local.id })
        result.pulled++
      }
    }

    for (const remote of data.templates ?? []) {
      const db = getDb()
      const local = await db.templates.where('localId').equals(remote.localId).first()
      const normalized = normalizeRemoteTemplate(remote)
      if (!local) {
        await db.templates.add(normalized)
        result.pulled++
      } else {
        await db.templates.put({ ...normalized, id: local.id })
        result.pulled++
      }
    }

    await saveCursor(data.nextCursor)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al hacer pull'
    result.errors.push(`Pull fallido: ${msg}`)
  }

  return result
}

export { countPending }
