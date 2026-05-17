import { getDb } from '@/lib/db/database'
import { sha256 } from '@/lib/utils/hash'

export type CachedPromptTranslation = {
  translatedContent: string
  detectedSourceLanguage?: string
  notes?: string
  warnings?: string[]
  cachedAt: string
}

async function buildTranslationCacheKey(promptLocalId: string, content: string) {
  const hash = await sha256(content)
  return `prompt_translation_es:${promptLocalId}:${hash}`
}

export async function getCachedPromptTranslation(
  promptLocalId: string,
  content: string,
): Promise<CachedPromptTranslation | null> {
  const db = getDb()
  const key = await buildTranslationCacheKey(promptLocalId, content)
  const setting = await db.userSettings.where('key').equals(key).first()
  if (!setting?.value) return null

  try {
    const parsed = JSON.parse(setting.value) as CachedPromptTranslation
    if (!parsed.translatedContent?.trim()) return null
    return parsed
  } catch {
    return null
  }
}

export async function saveCachedPromptTranslation(
  promptLocalId: string,
  content: string,
  translation: Omit<CachedPromptTranslation, 'cachedAt'>,
): Promise<void> {
  const db = getDb()
  const key = await buildTranslationCacheKey(promptLocalId, content)
  const value = JSON.stringify({
    ...translation,
    cachedAt: new Date().toISOString(),
  } satisfies CachedPromptTranslation)
  const existing = await db.userSettings.where('key').equals(key).first()
  const setting = { key, value, updatedAt: new Date() }

  if (existing?.id) {
    await db.userSettings.update(existing.id, setting)
  } else {
    await db.userSettings.add(setting)
  }
}
