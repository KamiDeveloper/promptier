import { getDb } from '@/lib/db/database'
import type { ContentType, LocalTemplate } from '@/lib/db/schema'
import { generateId } from '@/lib/utils/generateId'
import { enqueue } from './syncOutboxRepository'

export type TemplateInput = {
  name: string
  content: string
  contentType: ContentType
  tags?: string[]
}

export async function createTemplate(input: TemplateInput): Promise<LocalTemplate> {
  const db = getDb()
  const now = new Date()
  const template: LocalTemplate = {
    localId: generateId(),
    name: input.name.trim(),
    content: input.content,
    contentType: input.contentType,
    tags: input.tags ?? [],
    syncStatus: 'local_only',
    createdAt: now,
    updatedAt: now,
  }
  const id = await db.templates.add(template)
  const created = { ...template, id: id as number }
  await enqueue('template', created.localId, 'upsert', created)
  return created
}

export async function listTemplates(): Promise<LocalTemplate[]> {
  const db = getDb()
  return db.templates.orderBy('name').toArray()
}

export async function updateTemplate(localId: string, input: Partial<TemplateInput>): Promise<void> {
  const db = getDb()
  const existing = await db.templates.where('localId').equals(localId).first()
  if (!existing) return
  const updated: LocalTemplate = {
    ...existing,
    ...input,
    tags: input.tags ?? existing.tags,
    updatedAt: new Date(),
    syncStatus: existing.syncStatus === 'synced' ? 'pending_upload' : existing.syncStatus,
  }
  await db.templates.put(updated)
  await enqueue('template', localId, 'upsert', updated)
}

export async function deleteTemplate(localId: string): Promise<void> {
  const db = getDb()
  const existing = await db.templates.where('localId').equals(localId).first()
  await db.templates.where('localId').equals(localId).delete()
  if (existing) await enqueue('template', localId, 'delete', existing)
}
