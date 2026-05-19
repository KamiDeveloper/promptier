// Client-side manual sync with Neon DB.
// Triggered explicitly by the user. Never runs automatically.
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
import type { LocalCollection, LocalPrompt, LocalPromptImage, LocalTemplate } from '@/lib/db/schema'
import { blobToDataUrl, optimizeImage } from '@/lib/services/imageService'
import {
  buildImagePushItem,
  canPushImageForPrompt,
  isImagePendingCloudSync,
  mergeRemotePromptImage,
  type ImagePushItem,
  type RemotePromptImage,
} from '@/lib/services/imageSyncMerge'

const VAULT_SYNC_CURSOR_KEY = 'sync_cursor'
const IMAGE_SYNC_CURSOR_KEY = 'sync_images_cursor'

export type SyncResult = {
  pushed: number
  pulled: number
  conflicts: number
  errors: string[]
  imagesPushed: number
  imagesPulled: number
  imagesDeleted: number
}

type ImagePushResponse = {
  results: Array<{
    localId: string
    remoteId?: string
    status: 'applied' | 'skipped' | 'error'
    updatedAt?: string
    error?: string
  }>
}

type ImagePullResponse = {
  images: RemotePromptImage[]
  nextCursor: string
  hasMore: boolean
}

/**
 * Reads a pull cursor from local settings.
 */
async function getLastCursor(key = VAULT_SYNC_CURSOR_KEY): Promise<string | null> {
  const db = getDb()
  const setting = await db.userSettings.where('key').equals(key).first()
  return (setting?.value as string) ?? null
}

/**
 * Saves a pull cursor to local settings.
 */
async function saveCursor(cursor: string, key = VAULT_SYNC_CURSOR_KEY): Promise<void> {
  const db = getDb()
  const existing = await db.userSettings.where('key').equals(key).first()
  const setting = { key, value: cursor, updatedAt: new Date() }

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
    collectionId: remote.collectionId ?? undefined,
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
    parentId: remote.parentId ?? undefined,
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

async function pushOutboxOperations(result: SyncResult): Promise<void> {
  const pending = await getPendingItems()
  if (pending.length === 0) return

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
          const changes: Partial<LocalPrompt> = { syncStatus: 'synced' }
          if (r.remoteId) changes.remoteId = r.remoteId
          if (typeof r.remoteVersion === 'number') changes.remoteVersion = r.remoteVersion
          await db.prompts.where('localId').equals(r.entityLocalId).modify(changes)
        } else if (r.entityType === 'collection' && r.entityLocalId) {
          const changes: Partial<LocalCollection> = { syncStatus: 'synced' }
          if (r.remoteId) changes.remoteId = r.remoteId
          await db.collections.where('localId').equals(r.entityLocalId).modify(changes)
        } else if (r.entityType === 'template' && r.entityLocalId) {
          const changes: Partial<LocalTemplate> = { syncStatus: 'synced' }
          if (r.remoteId) changes.remoteId = r.remoteId
          await db.templates.where('localId').equals(r.entityLocalId).modify(changes)
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

async function pullVaultEntities(result: SyncResult): Promise<void> {
  let promptsCursor = await getLastCursor('sync_prompts_cursor')
  let collectionsCursor = await getLastCursor('sync_collections_cursor')
  let templatesCursor = await getLastCursor('sync_templates_cursor')

  // Fallback for legacy single cursor if it exists
  const legacyCursor = await getLastCursor(VAULT_SYNC_CURSOR_KEY)
  if (legacyCursor) {
    if (!promptsCursor) promptsCursor = legacyCursor
    if (!collectionsCursor) collectionsCursor = legacyCursor
    if (!templatesCursor) templatesCursor = legacyCursor
    const db = getDb()
    await db.userSettings.where('key').equals(VAULT_SYNC_CURSOR_KEY).delete()
  }

  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({ limit: '50' })
    if (promptsCursor) params.set('prompts_cursor', promptsCursor)
    if (collectionsCursor) params.set('collections_cursor', collectionsCursor)
    if (templatesCursor) params.set('templates_cursor', templatesCursor)

    const res = await fetch(`/api/sync/pull?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json() as { error?: string }
      throw new Error(err?.error ?? `HTTP ${res.status}`)
    }

    const data = await res.json() as {
      prompts: LocalPrompt[]
      collections: LocalCollection[]
      templates: LocalTemplate[]
      nextCursors: {
        prompts: string
        collections: string
        templates: string
      }
      hasMore: boolean
    }

    const db = getDb()
    for (const remote of data.prompts) {
      try {
        const local = await getPromptByLocalId(remote.localId)
        const normalized = normalizeRemotePrompt(remote)

        if (!local) {
          await db.prompts.add(normalized)
          result.pulled++
        } else if (remote.baseVersion > local.baseVersion) {
          if (remote.syncStatus !== 'pending_upload') {
            await db.prompts.put({ ...normalized, id: local.id })
            result.pulled++
          } else {
            await db.prompts.where('localId').equals(local.localId).modify({ syncStatus: 'conflict' })
            result.conflicts++
          }
        } else if (remote.baseVersion < local.baseVersion) {
          await db.prompts.where('localId').equals(local.localId).modify({ syncStatus: 'conflict' })
          result.conflicts++
        }
      } catch (err) {
        result.errors.push(`Pull prompt ${remote.localId}: ${String(err)}`)
      }
    }

    for (const remote of data.collections ?? []) {
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

    await saveCursor(data.nextCursors.prompts, 'sync_prompts_cursor')
    await saveCursor(data.nextCursors.collections, 'sync_collections_cursor')
    await saveCursor(data.nextCursors.templates, 'sync_templates_cursor')

    hasMore = data.hasMore

    if (
      hasMore &&
      data.nextCursors.prompts === promptsCursor &&
      data.nextCursors.collections === collectionsCursor &&
      data.nextCursors.templates === templatesCursor
    ) {
      result.errors.push('Pull detenido: los cursores remotos no avanzaron.')
      break
    }

    promptsCursor = data.nextCursors.prompts
    collectionsCursor = data.nextCursors.collections
    templatesCursor = data.nextCursors.templates
  }
}

async function postImagePush(items: ImagePushItem[]): Promise<ImagePushResponse> {
  const res = await fetch('/api/sync/images/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: items }),
  })

  if (!res.ok) {
    const err = await res.json() as { error?: string; details?: unknown }
    const details = err.details ? ` ${JSON.stringify(err.details)}` : ''
    throw new Error(`${err?.error ?? `HTTP ${res.status}`}${details}`)
  }

  return res.json() as Promise<ImagePushResponse>
}

async function getOptimizedDataForPush(image: LocalPromptImage): Promise<{
  dataUrl: string
  image: LocalPromptImage
} | null> {
  if (image.remoteUrl?.startsWith('data:image/')) {
    return { dataUrl: image.remoteUrl, image }
  }

  if (image.optimizedBlob) {
    return {
      dataUrl: await blobToDataUrl(image.optimizedBlob),
      image,
    }
  }

  if (!image.originalBlob) return null

  const db = getDb()
  const optimized = await optimizeImage(image.originalBlob)
  const updatedAt = new Date()
  const updatedImage: LocalPromptImage = {
    ...image,
    optimizedBlob: optimized.blob,
    remoteUrl: optimized.dataUrl,
    sha256: optimized.sha256,
    mimeType: optimized.mimeType,
    width: optimized.width,
    height: optimized.height,
    updatedAt,
  }

  await db.promptImages.where('localId').equals(image.localId).modify({
    optimizedBlob: optimized.blob,
    remoteUrl: optimized.dataUrl,
    sha256: optimized.sha256,
    mimeType: optimized.mimeType,
    width: optimized.width,
    height: optimized.height,
    updatedAt,
  })

  return { dataUrl: optimized.dataUrl, image: updatedImage }
}

async function removeLocalImage(image: LocalPromptImage): Promise<void> {
  const db = getDb()
  if (typeof image.id === 'number') {
    await db.promptImages.delete(image.id)
  } else {
    await db.promptImages.where('localId').equals(image.localId).delete()
  }
}

async function pushPromptImages(result: SyncResult): Promise<void> {
  const db = getDb()
  const images = await db.promptImages.toArray()
  const pendingImages = images.filter(isImagePendingCloudSync)

  for (const image of pendingImages) {
    try {
      if (image.deletedAt || image.syncStatus === 'pending_delete') {
        const data = await postImagePush([buildImagePushItem(image, 'delete')])
        const pushed = data.results[0]

        if (pushed?.status === 'applied' || pushed?.status === 'skipped') {
          await removeLocalImage(image)
          result.imagesDeleted++
        } else {
          result.errors.push(`Push image delete ${image.localId}: ${pushed?.error ?? 'Error desconocido'}`)
        }
        continue
      }

      const prompt = await db.prompts.where('localId').equals(image.promptLocalId).first()
      if (!prompt) {
        result.errors.push(`Push image ${image.localId}: prompt local no encontrado.`)
        continue
      }

      if (!canPushImageForPrompt(prompt)) {
        continue
      }

      const optimized = await getOptimizedDataForPush(image)
      if (!optimized) {
        result.errors.push(`Push image ${image.localId}: falta copia optimizada.`)
        continue
      }

      const data = await postImagePush([buildImagePushItem(optimized.image, 'upsert', optimized.dataUrl)])
      const pushed = data.results[0]

      if (pushed?.status === 'applied') {
        await db.promptImages.where('localId').equals(image.localId).modify({
          remoteId: pushed.remoteId,
          remoteUrl: optimized.dataUrl,
          syncStatus: 'synced',
          updatedAt: pushed.updatedAt ? new Date(pushed.updatedAt) : new Date(),
        })
        result.imagesPushed++
      } else if (pushed?.status === 'skipped') {
        result.errors.push(`Push image ${image.localId}: ${pushed.error ?? 'omitida por el servidor'}`)
      } else {
        result.errors.push(`Push image ${image.localId}: ${pushed?.error ?? 'Error desconocido'}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Push image ${image.localId}: ${msg}`)
    }
  }
}

async function pullPromptImages(result: SyncResult): Promise<void> {
  let cursor = await getLastCursor(IMAGE_SYNC_CURSOR_KEY)
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({ limit: '50' })
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`/api/sync/images/pull?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json() as { error?: string }
      throw new Error(err?.error ?? `HTTP ${res.status}`)
    }

    const data = await res.json() as ImagePullResponse
    const db = getDb()
    let canAdvanceCursor = true

    for (const remote of data.images) {
      try {
        const local = await db.promptImages.where('localId').equals(remote.localId).first()

        if (remote.deletedAt) {
          if (local) {
            await removeLocalImage(local)
            result.imagesDeleted++
          }
          continue
        }

        if (local?.deletedAt || local?.syncStatus === 'pending_delete') {
          continue
        }

        const prompt = await db.prompts.where('localId').equals(remote.promptLocalId).first()
        if (!prompt || prompt.deletedAt) {
          // If prompt is deleted or not found locally, we clean up the local image copy if it exists and skip
          if (local) {
            await removeLocalImage(local)
            result.imagesDeleted++
          }
          continue
        }

        const merged = await mergeRemotePromptImage(local, remote)
        if (merged.action === 'delete') {
          if (local) {
            await removeLocalImage(local)
            result.imagesDeleted++
          }
          continue
        }

        if (local?.id) {
          await db.promptImages.put({ ...merged.image, id: local.id })
        } else {
          await db.promptImages.add(merged.image)
        }
        result.imagesPulled++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Pull image ${remote.localId}: ${msg}`)
      }
    }

    if (!canAdvanceCursor) break

    await saveCursor(data.nextCursor, IMAGE_SYNC_CURSOR_KEY)
    hasMore = data.hasMore

    if (hasMore && data.nextCursor === cursor) {
      result.errors.push('Pull de imagenes detenido: el cursor remoto no avanzo.')
      break
    }

    cursor = data.nextCursor
  }
}

/**
 * Performs a full manual sync cycle:
 * 1. Push prompt/collection/template outbox operations.
 * 2. Pull all remote prompt/collection/template pages.
 * 3. Push optimized prompt image copies and tombstones.
 * 4. Pull all remote image pages into IndexedDB.
 */
export async function syncVault(): Promise<SyncResult> {
  const result: SyncResult = {
    pushed: 0,
    pulled: 0,
    conflicts: 0,
    errors: [],
    imagesPushed: 0,
    imagesPulled: 0,
    imagesDeleted: 0,
  }

  await pushOutboxOperations(result)

  try {
    await pullVaultEntities(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al hacer pull'
    result.errors.push(`Pull fallido: ${msg}`)
  }

  await pushPromptImages(result)

  try {
    await pullPromptImages(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al descargar imagenes'
    result.errors.push(`Pull imagenes fallido: ${msg}`)
  }

  return result
}

export { countPending }
