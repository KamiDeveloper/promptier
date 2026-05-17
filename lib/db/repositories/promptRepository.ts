import { getDb } from '@/lib/db/database'
import type { LocalPrompt, SyncStatus } from '@/lib/db/schema'
import { generateId } from '@/lib/utils/generateId'
import { enqueue } from './syncOutboxRepository'

export interface CreatePromptInput {
  title:       string
  content:     string
  contentType: LocalPrompt['contentType']
  description?: string
  tags?:       string[]
  type?:       LocalPrompt['type']
  model?:      string
  collectionId?: string
}

export interface UpdatePromptInput extends Partial<CreatePromptInput> {
  isFavorite?:  boolean
  qualityScore?: number
  aiTags?:      string[]
}

// ─── CRUD ─────────────────────────────────────────────────────────────────

export async function createPrompt(input: CreatePromptInput): Promise<LocalPrompt> {
  const db = getDb()
  const now = new Date()
  const prompt: LocalPrompt = {
    localId:      generateId(),
    title:        input.title,
    content:      input.content,
    contentType:  input.contentType,
    description:  input.description,
    tags:         input.tags ?? [],
    type:         input.type ?? 'image_generation',
    model:        input.model,
    isFavorite:   false,
    collectionId: input.collectionId,
    orderIndex:   Date.now(),
    syncStatus:   'local_only',
    baseVersion:  1,
    copyCount:    0,
    createdAt:    now,
    updatedAt:    now,
  }
  const id = await db.prompts.add(prompt)
  const created = { ...prompt, id: id as number }
  await enqueue('prompt', created.localId, 'upsert', created)
  return created
}

export async function getPromptByLocalId(localId: string): Promise<LocalPrompt | undefined> {
  const db = getDb()
  return db.prompts.where('localId').equals(localId).first()
}

export async function listPrompts(options?: {
  collectionId?: string
  isFavorite?:   boolean
  type?:         LocalPrompt['type']
  tags?:         string[]
  syncStatus?:   SyncStatus
  includeDeleted?: boolean
}): Promise<LocalPrompt[]> {
  const db = getDb()
  let query = db.prompts.orderBy('updatedAt').reverse()

  const results = await query.toArray()

  return results.filter((p) => {
    if (!options?.includeDeleted && p.deletedAt) return false
    if (options?.collectionId !== undefined && p.collectionId !== options.collectionId) return false
    if (options?.isFavorite !== undefined && p.isFavorite !== options.isFavorite) return false
    if (options?.type !== undefined && p.type !== options.type) return false
    if (options?.syncStatus !== undefined && p.syncStatus !== options.syncStatus) return false
    if (options?.tags?.length) {
      const hasAll = options.tags.every((t) => p.tags.includes(t))
      if (!hasAll) return false
    }
    return true
  }).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
}

export async function searchPrompts(query: string): Promise<LocalPrompt[]> {
  const db  = getDb()
  const q   = query.toLowerCase().trim()
  if (!q) return listPrompts()

  const all = await db.prompts.toArray()
  return all.filter((p) => {
    if (p.deletedAt) return false
    return (
      p.title.toLowerCase().includes(q)      ||
      p.content.toLowerCase().includes(q)    ||
      p.description?.toLowerCase().includes(q) ||
      p.model?.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    )
  })
}

export async function updatePrompt(localId: string, input: UpdatePromptInput): Promise<void> {
  const db = getDb()
  const existing = await db.prompts.where('localId').equals(localId).first()
  if (!existing) throw new Error(`Prompt ${localId} not found`)

  const updated: LocalPrompt = {
    ...existing,
    ...input,
    updatedAt:   new Date(),
    baseVersion: existing.baseVersion + 1,
    syncStatus:  existing.syncStatus === 'synced' ? 'pending_upload' : existing.syncStatus,
  }
  await db.prompts.put(updated)
  await enqueue('prompt', localId, 'upsert', updated)
}

export async function softDeletePrompt(localId: string): Promise<void> {
  const db = getDb()
  const existing = await db.prompts.where('localId').equals(localId).first()
  if (!existing) return
  const updated: LocalPrompt = {
    ...existing,
    deletedAt:  new Date(),
    syncStatus: 'pending_delete' as SyncStatus,
    updatedAt:  new Date(),
    baseVersion: existing.baseVersion + 1,
  }
  await db.prompts.where('localId').equals(localId).modify({
    deletedAt: updated.deletedAt,
    syncStatus: updated.syncStatus,
    updatedAt: updated.updatedAt,
    baseVersion: updated.baseVersion,
  })
  await enqueue('prompt', localId, 'delete', updated)
}

export async function recordCopy(localId: string): Promise<void> {
  const db = getDb()
  await db.prompts.where('localId').equals(localId).modify((p) => {
    p.copyCount    += 1
    p.lastCopiedAt  = new Date()
  })
  await db.copyHistory.add({ promptLocalId: localId, copiedAt: new Date() })
}

export async function toggleFavorite(localId: string): Promise<void> {
  const db = getDb()
  await db.prompts.where('localId').equals(localId).modify((p) => {
    p.isFavorite = !p.isFavorite
    p.updatedAt  = new Date()
  })
}

export async function reorderPrompts(localIds: string[]): Promise<void> {
  const db = getDb()
  const now = new Date()
  await db.transaction('rw', db.prompts, db.syncOutbox, async () => {
    for (const [index, localId] of localIds.entries()) {
      const prompt = await db.prompts.where('localId').equals(localId).first()
      if (!prompt) continue
      const updated: LocalPrompt = {
        ...prompt,
        orderIndex: index,
        updatedAt: now,
        syncStatus: prompt.syncStatus === 'synced' ? 'pending_upload' : prompt.syncStatus,
      }
      await db.prompts.put(updated)
      await enqueue('prompt', localId, 'upsert', updated)
    }
  })
}

// ─── Versions — max 5 per prompt ──────────────────────────────────────────

export async function saveVersion(localId: string): Promise<void> {
  const db     = getDb()
  const prompt = await db.prompts.where('localId').equals(localId).first()
  if (!prompt) return

  // Count existing versions
  const versions = await db.promptVersions
    .where('promptLocalId').equals(localId)
    .sortBy('savedAt')

  if (versions.length >= 5) {
    // Delete oldest (spec: max 5 snapshots)
    await db.promptVersions.delete(versions[0].id!)
  }

  await db.promptVersions.add({
    promptLocalId: localId,
    content:       prompt.content,
    title:         prompt.title,
    savedAt:       new Date(),
  })
}

export async function getVersions(localId: string) {
  const db = getDb()
  return db.promptVersions
    .where('promptLocalId').equals(localId)
    .reverse()
    .sortBy('savedAt')
}
