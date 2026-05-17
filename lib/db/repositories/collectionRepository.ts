import { getDb } from '@/lib/db/database'
import type { LocalCollection } from '@/lib/db/schema'
import { generateId } from '@/lib/utils/generateId'
import { enqueue } from './syncOutboxRepository'

export async function createCollection(name: string, parentId?: string): Promise<LocalCollection> {
  const db = getDb()

  // Spec: max one level of nesting
  if (parentId) {
    const parent = await db.collections.where('localId').equals(parentId).first()
    if (parent?.parentId) {
      throw new Error('Las colecciones solo permiten un nivel de subcarpetas.')
    }
  }

  const now = new Date()
  const col: LocalCollection = {
    localId:    generateId(),
    name,
    parentId,
    syncStatus: 'local_only',
    createdAt:  now,
    updatedAt:  now,
  }
  const id = await db.collections.add(col)
  const created = { ...col, id: id as number }
  await enqueue('collection', created.localId, 'upsert', created)
  return created
}

export async function listCollections(): Promise<LocalCollection[]> {
  const db = getDb()
  return db.collections.orderBy('name').toArray()
}

export async function renameCollection(localId: string, name: string): Promise<void> {
  const db = getDb()
  const existing = await db.collections.where('localId').equals(localId).first()
  if (!existing) return
  const updated: LocalCollection = {
    ...existing,
    name,
    updatedAt:  new Date(),
    syncStatus: existing.syncStatus === 'synced' ? 'pending_upload' : existing.syncStatus,
  }
  await db.collections.put(updated)
  await enqueue('collection', localId, 'upsert', updated)
}

export async function deleteCollection(localId: string): Promise<void> {
  const db = getDb()
  const existing = await db.collections.where('localId').equals(localId).first()
  await db.collections.where('localId').equals(localId).delete()
  // Unlink prompts that belonged to this collection
  await db.prompts.where('collectionId').equals(localId).modify({
    collectionId: undefined,
    updatedAt:    new Date(),
  })
  if (existing) await enqueue('collection', localId, 'delete', existing)
}
