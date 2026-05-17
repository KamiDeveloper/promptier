import { expect, test } from 'bun:test'
import type { LocalPromptImage } from '@/lib/db/schema'
import {
  buildImagePushItem,
  canPushImageForPrompt,
  mergeRemotePromptImage,
  type RemotePromptImage,
} from '@/lib/services/imageSyncMerge'

const dataUrl = 'data:image/webp;base64,cmVtb3Rl'

function remoteImage(overrides: Partial<RemotePromptImage> = {}): RemotePromptImage {
  return {
    localId: 'image-local-1',
    remoteId: 'image-remote-1',
    promptLocalId: 'prompt-local-1',
    dataUrl,
    sha256: '1234567890abcdef',
    mimeType: 'image/webp',
    width: 64,
    height: 64,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:05:00.000Z',
    ...overrides,
  }
}

function localImage(overrides: Partial<LocalPromptImage> = {}): LocalPromptImage {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    localId: 'image-local-1',
    promptLocalId: 'prompt-local-1',
    optimizedBlob: new Blob(['local-optimized'], { type: 'image/webp' }),
    sha256: 'fedcba0987654321',
    mimeType: 'image/webp',
    width: 32,
    height: 32,
    syncStatus: 'local_only',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

test('remote image without local copy creates optimized image without original', async () => {
  const result = await mergeRemotePromptImage(undefined, remoteImage())

  expect(result.action).toBe('upsert')
  if (result.action !== 'upsert') throw new Error('Expected upsert')

  expect(result.image.originalBlob).toBeUndefined()
  expect(result.image.remoteUrl).toBe(dataUrl)
  expect(result.image.optimizedBlob).toBeInstanceOf(Blob)
  expect(await result.image.optimizedBlob?.text()).toBe('remote')
  expect(result.image.syncStatus).toBe('synced')
})

test('remote image over local image preserves original blob', async () => {
  const originalBlob = new Blob(['original'], { type: 'image/png' })
  const optimizedBlob = new Blob(['local-optimized'], { type: 'image/webp' })
  const result = await mergeRemotePromptImage(
    localImage({ originalBlob, optimizedBlob, remoteUrl: undefined }),
    remoteImage({ width: 128, height: 128 }),
  )

  expect(result.action).toBe('upsert')
  if (result.action !== 'upsert') throw new Error('Expected upsert')

  expect(result.image.originalBlob).toBe(originalBlob)
  expect(result.image.optimizedBlob).toBe(optimizedBlob)
  expect(result.image.remoteUrl).toBe(dataUrl)
  expect(result.image.width).toBe(128)
  expect(result.image.height).toBe(128)
})

test('remote tombstone deletes local image', async () => {
  const result = await mergeRemotePromptImage(
    localImage({ originalBlob: new Blob(['original'], { type: 'image/png' }) }),
    remoteImage({ dataUrl: null, deletedAt: '2026-01-01T00:10:00.000Z' }),
  )

  expect(result.action).toBe('delete')
})

test('image push payload never includes original blob', () => {
  const item = buildImagePushItem(
    localImage({ originalBlob: new Blob(['original'], { type: 'image/png' }) }),
    'upsert',
    dataUrl,
  )

  expect(item.dataUrl).toBe(dataUrl)
  expect('originalBlob' in item).toBe(false)
  expect(JSON.stringify(item)).not.toContain('original')
})

test('local image waits until its prompt exists in the cloud', () => {
  expect(canPushImageForPrompt(undefined)).toBe(false)
  expect(canPushImageForPrompt({ syncStatus: 'local_only' })).toBe(false)
  expect(canPushImageForPrompt({ syncStatus: 'synced' })).toBe(true)
  expect(canPushImageForPrompt({ remoteId: 'prompt-remote-1', syncStatus: 'local_only' })).toBe(true)
})
