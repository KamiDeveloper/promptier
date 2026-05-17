import { getDb } from '@/lib/db/database'
import type { LocalPromptImage } from '@/lib/db/schema'
import { generateId } from '@/lib/utils/generateId'
import { optimizeImage } from '@/lib/services/imageService'
import { sha256 } from '@/lib/utils/hash'

export async function addPromptImage(promptLocalId: string, file: File): Promise<LocalPromptImage> {
  const db = getDb()
  const optimized = await optimizeImage(file)
  const now = new Date()
  const image: LocalPromptImage = {
    localId: generateId(),
    promptLocalId,
    originalBlob: file,
    optimizedBlob: optimized.blob,
    remoteUrl: optimized.dataUrl,
    sha256: optimized.sha256,
    mimeType: optimized.mimeType,
    width: optimized.width,
    height: optimized.height,
    syncStatus: 'local_only',
    createdAt: now,
    updatedAt: now,
  }
  const id = await db.promptImages.add(image)
  return { ...image, id: id as number }
}

export async function addOptimizedPromptImageFromDataUrl(
  promptLocalId: string,
  dataUrl: string,
): Promise<LocalPromptImage> {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Expected an optimized image data URL.')
  }

  const db = getDb()
  const blob = await dataUrlToBlob(dataUrl)
  const dimensions = await getImageDimensions(blob)
  const arrayBuffer = await blob.arrayBuffer()
  const now = new Date()

  const image: LocalPromptImage = {
    localId: generateId(),
    promptLocalId,
    optimizedBlob: blob,
    remoteUrl: dataUrl,
    sha256: await sha256(arrayBuffer),
    mimeType: blob.type || parseDataUrlMimeType(dataUrl) || 'image/webp',
    width: dimensions?.width,
    height: dimensions?.height,
    syncStatus: 'local_only',
    createdAt: now,
    updatedAt: now,
  }

  const id = await db.promptImages.add(image)
  return { ...image, id: id as number }
}

export async function listPromptImages(promptLocalId: string): Promise<LocalPromptImage[]> {
  const db = getDb()
  const images = await db.promptImages.where('promptLocalId').equals(promptLocalId).toArray()
  return images
    .filter((image) => !image.deletedAt)
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
}

export async function listAllPromptImages(): Promise<LocalPromptImage[]> {
  const db = getDb()
  const images = await db.promptImages.orderBy('createdAt').reverse().toArray()
  return images.filter((image) => !image.deletedAt)
}

export async function deletePromptImage(localId: string): Promise<void> {
  const db = getDb()
  const existing = await db.promptImages.where('localId').equals(localId).first()
  if (!existing) return

  if (existing.remoteId || existing.syncStatus === 'synced' || existing.syncStatus === 'pending_upload') {
    const now = new Date()
    await db.promptImages.where('localId').equals(localId).modify({
      deletedAt: now,
      updatedAt: now,
      syncStatus: 'pending_delete',
    })
    return
  }

  await db.promptImages.where('localId').equals(localId).delete()
}

export async function updatePromptImageDimensions(
  localId: string,
  dimensions: { width: number; height: number },
): Promise<void> {
  const db = getDb()
  await db.promptImages.where('localId').equals(localId).modify({
    width: dimensions.width,
    height: dimensions.height,
    updatedAt: new Date(),
  })
}

export async function getBestImageUrl(image: LocalPromptImage): Promise<string | null> {
  const blob = image.originalBlob ?? image.optimizedBlob
  if (blob) return URL.createObjectURL(blob)
  return image.remoteUrl ?? null
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('Failed to read image data URL.')
  return response.blob()
}

function parseDataUrlMimeType(dataUrl: string): string | null {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl)
  return match?.[1] ?? null
}

function getImageDimensions(blob: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}
