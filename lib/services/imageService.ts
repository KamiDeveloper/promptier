// Image optimization service — browser only (uses Canvas API)
// Spec: image-pipeline — "Online images shall be optimized before upload"
// Max dimension: 720px. Format: WebP 85% quality, JPEG fallback.

import { sha256 } from '@/lib/utils/hash'

export const IMAGE_MAX_DIMENSION = 720
export const IMAGE_WEBP_QUALITY  = 0.85
export const IMAGE_JPEG_QUALITY  = 0.85
export const IMAGE_MAX_BYTES     = 5 * 1024 * 1024 // 5 MB payload limit

export interface OptimizedImage {
  blob:     Blob
  mimeType: string
  width:    number
  height:   number
  sha256:   string
  dataUrl:  string
}

/**
 * Load a File or Blob into an HTMLImageElement.
 */
function loadImage(source: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

/**
 * Scale dimensions preserving aspect ratio, capped at IMAGE_MAX_DIMENSION.
 */
function scaleDimensions(w: number, h: number): { width: number; height: number } {
  const max = IMAGE_MAX_DIMENSION
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = Math.min(max / w, max / h)
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

/**
 * Optimize a File to ≤720p WebP (fallback JPEG).
 * Returns the optimized Blob + metadata.
 */
export async function optimizeImage(file: File | Blob): Promise<OptimizedImage> {
  if (typeof window === 'undefined') {
    throw new Error('optimizeImage() must run in browser context.')
  }

  const img              = await loadImage(file)
  const { width, height } = scaleDimensions(img.naturalWidth, img.naturalHeight)

  const canvas  = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)

  // Try WebP first
  const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  const mimeType     = supportsWebP ? 'image/webp' : 'image/jpeg'
  const quality      = mimeType === 'image/webp' ? IMAGE_WEBP_QUALITY : IMAGE_JPEG_QUALITY

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Canvas toBlob failed')),
      mimeType,
      quality,
    )
  })

  if (blob.size > IMAGE_MAX_BYTES) {
    throw new Error(`Optimized image exceeds ${IMAGE_MAX_BYTES / 1024 / 1024}MB payload limit.`)
  }

  const arrayBuffer = await blob.arrayBuffer()
  const hash        = await sha256(arrayBuffer)
  const dataUrl     = await blobToDataUrl(blob)

  return { blob, mimeType, width, height, sha256: hash, dataUrl }
}

/**
 * Convert a Blob to a base64 data URL.
 * Used when sending online images to Neon (spec: "optimized base64 image storage online").
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}
