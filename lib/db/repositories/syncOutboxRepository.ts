import { getDb } from '@/lib/db/database'
import type { LocalSyncOutboxItem, OutboxEntityType, OutboxOperation } from '@/lib/db/schema'
import { generateId } from '@/lib/utils/generateId'

export async function enqueue(
  entityType: OutboxEntityType,
  entityLocalId: string,
  operation: OutboxOperation,
  payload: object,
): Promise<LocalSyncOutboxItem> {
  const db = getDb()
  const item: LocalSyncOutboxItem = {
    operationId:   generateId(),
    entityType,
    entityLocalId,
    operation,
    payload:       JSON.stringify(payload),
    createdAt:     new Date(),
    attempts:      0,
    status:        'pending',
  }
  const id = await db.syncOutbox.add(item)
  return { ...item, id: id as number }
}

export async function getPendingItems(): Promise<LocalSyncOutboxItem[]> {
  const db = getDb()
  return db.syncOutbox
    .where('status').anyOf(['pending', 'failed'])
    .toArray()
}

export async function markDone(operationId: string): Promise<void> {
  const db = getDb()
  await db.syncOutbox.where('operationId').equals(operationId).modify({ status: 'done' })
}

export async function markFailed(operationId: string, error: string): Promise<void> {
  const db = getDb()
  await db.syncOutbox.where('operationId').equals(operationId).modify({
    status:        'failed',
    error,
    lastAttemptAt: new Date(),
  })
  await db.syncOutbox.where('operationId').equals(operationId).modify((item) => {
    item.attempts += 1
  })
}

export async function countPending(): Promise<number> {
  const db = getDb()
  return db.syncOutbox.where('status').anyOf(['pending', 'failed']).count()
}
