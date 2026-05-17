import 'server-only'

import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { sql } from '@/lib/db/neon'
import {
  buildGeminiKeyAad,
  decryptSecret,
  encryptSecret,
  fingerprintSecret,
  getCurrentEncryptionKid,
  previewSecret,
} from '@/lib/security/secretCrypto'
import { AiServiceError } from '@/lib/services/aiErrors'

const GEMINI_MODEL = 'gemini-3-flash-preview'
const GEMINI_PROVIDER = 'gemini'

export const GEMINI_THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'] as const
export type GeminiThinkingLevel = typeof GEMINI_THINKING_LEVELS[number]

type AiKeyRow = {
  key_preview: string
  thinking_level: GeminiThinkingLevel
  status: string
  last_used_at: string | Date | null
  last_validated_at: string | Date | null
}

type EncryptedAiKeyRow = AiKeyRow & {
  encrypted_key: string
  iv: string
  auth_tag: string
  encryption_kid: string
}

export type GeminiKeyMetadata = {
  hasGeminiKey: boolean
  keyPreview: string | null
  thinkingLevel: GeminiThinkingLevel
  lastUsedAt: string | null
  lastValidatedAt: string | null
  status: string | null
}

export type GeminiKeyMaterial = GeminiKeyMetadata & {
  apiKey: string
  hasGeminiKey: true
}

function toIsoString(value: string | Date | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function isGeminiThinkingLevel(value: unknown): value is GeminiThinkingLevel {
  return typeof value === 'string' && GEMINI_THINKING_LEVELS.includes(value as GeminiThinkingLevel)
}

export function toSdkThinkingLevel(level: GeminiThinkingLevel): ThinkingLevel {
  return ThinkingLevel[level]
}

function toMetadata(row?: AiKeyRow): GeminiKeyMetadata {
  if (!row || row.status !== 'active') {
    return {
      hasGeminiKey: false,
      keyPreview: null,
      thinkingLevel: 'LOW',
      lastUsedAt: null,
      lastValidatedAt: null,
      status: null,
    }
  }

  return {
    hasGeminiKey: true,
    keyPreview: row.key_preview,
    thinkingLevel: row.thinking_level,
    lastUsedAt: toIsoString(row.last_used_at),
    lastValidatedAt: toIsoString(row.last_validated_at),
    status: row.status,
  }
}

function normalizeGeminiApiKey(apiKey: string) {
  return apiKey.trim()
}

function assertGeminiApiKeyShape(apiKey: string) {
  if (apiKey.length < 20 || apiKey.length > 300 || /\s/.test(apiKey)) {
    throw new AiServiceError(
      'GEMINI_KEY_INVALID',
      'La API key de Gemini no tiene un formato valido.',
      422,
    )
  }
}

export async function validateGeminiKey(apiKey: string) {
  const normalized = normalizeGeminiApiKey(apiKey)
  assertGeminiApiKeyShape(normalized)

  try {
    const ai = new GoogleGenAI({ apiKey: normalized })
    await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'Return only the word OK.',
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: false },
      },
    })
  } catch {
    throw new AiServiceError(
      'GEMINI_KEY_INVALID',
      'No pudimos validar esa API key con Gemini. Revisa la clave e intenta de nuevo.',
      422,
    )
  }

  return normalized
}

export async function saveGeminiKey(authUserId: string, apiKey: string): Promise<GeminiKeyMetadata> {
  const normalized = await validateGeminiKey(apiKey)
  const encryptionKid = getCurrentEncryptionKid()
  const aad = buildGeminiKeyAad(authUserId, encryptionKid)
  const encrypted = encryptSecret(normalized, aad, encryptionKid)
  const fingerprint = fingerprintSecret(normalized)
  const preview = previewSecret(normalized)

  const rows = (await sql`
    INSERT INTO user_ai_keys (
      auth_user_id,
      provider,
      encrypted_key,
      iv,
      auth_tag,
      key_fingerprint,
      key_preview,
      encryption_kid,
      thinking_level,
      status,
      last_validated_at,
      created_at,
      updated_at
    )
    VALUES (
      ${authUserId},
      ${GEMINI_PROVIDER},
      decode(${encrypted.encryptedKey}, 'base64'),
      decode(${encrypted.iv}, 'base64'),
      decode(${encrypted.authTag}, 'base64'),
      ${fingerprint},
      ${preview},
      ${encrypted.encryptionKid},
      'MEDIUM',
      'active',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (auth_user_id, provider)
    DO UPDATE SET
      encrypted_key = EXCLUDED.encrypted_key,
      iv = EXCLUDED.iv,
      auth_tag = EXCLUDED.auth_tag,
      key_fingerprint = EXCLUDED.key_fingerprint,
      key_preview = EXCLUDED.key_preview,
      encryption_kid = EXCLUDED.encryption_kid,
      status = 'active',
      last_validated_at = NOW(),
      updated_at = NOW()
    RETURNING key_preview, thinking_level, status, last_used_at, last_validated_at
  `) as AiKeyRow[]

  return toMetadata(rows[0])
}

export async function getGeminiKeyMetadata(authUserId: string): Promise<GeminiKeyMetadata> {
  const rows = (await sql`
    SELECT key_preview, thinking_level, status, last_used_at, last_validated_at
    FROM user_ai_keys
    WHERE auth_user_id = ${authUserId}
      AND provider = ${GEMINI_PROVIDER}
      AND status = 'active'
    LIMIT 1
  `) as AiKeyRow[]

  return toMetadata(rows[0])
}

export async function getGeminiKeyForUser(authUserId: string): Promise<GeminiKeyMaterial | null> {
  const rows = (await sql`
    SELECT
      encode(encrypted_key, 'base64') AS encrypted_key,
      encode(iv, 'base64') AS iv,
      encode(auth_tag, 'base64') AS auth_tag,
      encryption_kid,
      key_preview,
      thinking_level,
      status,
      last_used_at,
      last_validated_at
    FROM user_ai_keys
    WHERE auth_user_id = ${authUserId}
      AND provider = ${GEMINI_PROVIDER}
      AND status = 'active'
    LIMIT 1
  `) as EncryptedAiKeyRow[]
  const row = rows[0]
  if (!row) return null

  try {
    const aad = buildGeminiKeyAad(authUserId, row.encryption_kid)
    return {
      ...toMetadata(row),
      hasGeminiKey: true,
      apiKey: decryptSecret({
        encryptedKey: row.encrypted_key,
        iv: row.iv,
        authTag: row.auth_tag,
      }, aad),
    }
  } catch {
    throw new AiServiceError(
      'GEMINI_KEY_INVALID',
      'No se pudo usar la API key guardada. Reemplazala desde tu pagina de usuario.',
      409,
    )
  }
}

export async function deleteGeminiKey(authUserId: string) {
  await sql`
    DELETE FROM user_ai_keys
    WHERE auth_user_id = ${authUserId}
      AND provider = ${GEMINI_PROVIDER}
  `
}

export async function updateGeminiThinking(authUserId: string, thinkingLevel: GeminiThinkingLevel) {
  const rows = (await sql`
    UPDATE user_ai_keys
    SET thinking_level = ${thinkingLevel}, updated_at = NOW()
    WHERE auth_user_id = ${authUserId}
      AND provider = ${GEMINI_PROVIDER}
      AND status = 'active'
    RETURNING key_preview, thinking_level, status, last_used_at, last_validated_at
  `) as AiKeyRow[]

  if (!rows[0]) {
    throw new AiServiceError(
      'GEMINI_KEY_FORBIDDEN',
      'La configuracion de thinking solo esta disponible con API key propia.',
      403,
    )
  }

  return toMetadata(rows[0])
}

export async function touchGeminiKeyUsed(authUserId: string) {
  await sql`
    UPDATE user_ai_keys
    SET last_used_at = NOW(), updated_at = NOW()
    WHERE auth_user_id = ${authUserId}
      AND provider = ${GEMINI_PROVIDER}
      AND status = 'active'
  `
}
