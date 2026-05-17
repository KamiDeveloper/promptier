import type { LocalPrompt, LocalPromptImage } from '@/lib/db/schema'

export type RemotePromptImage = {
  localId: string
  remoteId: string
  promptLocalId: string
  dataUrl?: string | null
  sha256?: string
  mimeType: string
  width?: number
  height?: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type ImagePushOperation = 'upsert' | 'delete'

export type ImagePushItem = {
  localId: string
  promptLocalId: string
  operation: ImagePushOperation
  dataUrl?: string
  sha256?: string
  mimeType?: string
  width?: number
  height?: number
  createdAt?: string
  updatedAt?: string
}

export type ImageMergeResult =
  | { action: 'delete' }
  | { action: 'upsert'; image: LocalPromptImage }

export async function mergeRemotePromptImage(
  local: LocalPromptImage | undefined,
  remote: RemotePromptImage,
): Promise<ImageMergeResult> {
  if (remote.deletedAt) return { action: 'delete' }
  if (!remote.dataUrl?.startsWith('data:image/')) {
    throw new Error(`Remote image ${remote.localId} is missing optimized data.`)
  }

  const remoteBlob = local?.optimizedBlob ? undefined : await dataUrlToBlob(remote.dataUrl)

  return {
    action: 'upsert',
    image: {
      ...local,
      localId: local?.localId ?? remote.localId,
      remoteId: remote.remoteId,
      promptLocalId: local?.promptLocalId ?? remote.promptLocalId,
      originalBlob: local?.originalBlob,
      optimizedBlob: local?.optimizedBlob ?? remoteBlob,
      remoteUrl: local?.remoteUrl ?? remote.dataUrl,
      sha256: remote.sha256 ?? local?.sha256,
      mimeType: remote.mimeType || local?.mimeType || remoteBlob?.type || 'image/webp',
      width: remote.width ?? local?.width,
      height: remote.height ?? local?.height,
      syncStatus: 'synced',
      createdAt: local?.createdAt ?? new Date(remote.createdAt),
      updatedAt: new Date(remote.updatedAt),
      deletedAt: undefined,
    },
  }
}

export function buildImagePushItem(
  image: LocalPromptImage,
  operation: ImagePushOperation,
  dataUrl?: string,
): ImagePushItem {
  const item: ImagePushItem = {
    localId: image.localId,
    promptLocalId: image.promptLocalId,
    operation,
    updatedAt: (image.updatedAt ?? image.createdAt).toISOString(),
  }

  if (operation === 'delete') return item

  if (!dataUrl?.startsWith('data:image/')) {
    throw new Error(`Image ${image.localId} does not have an optimized data URL.`)
  }

  return {
    ...item,
    dataUrl,
    sha256: image.sha256,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt.toISOString(),
  }
}

export function isImagePendingCloudSync(image: LocalPromptImage): boolean {
  return (
    !!image.deletedAt ||
    !image.syncStatus ||
    image.syncStatus === 'local_only' ||
    image.syncStatus === 'pending_upload' ||
    image.syncStatus === 'pending_delete'
  )
}

export function canPushImageForPrompt(
  prompt: Pick<LocalPrompt, 'remoteId' | 'syncStatus' | 'deletedAt'> | undefined,
): boolean {
  if (!prompt || prompt.deletedAt) return false
  return Boolean(prompt.remoteId) || prompt.syncStatus === 'synced'
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl)
  if (!match) throw new Error('Invalid synced image data URL.')

  const mimeType = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const payload = match[3]
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))

  return new Blob([bytes], { type: mimeType })
}
