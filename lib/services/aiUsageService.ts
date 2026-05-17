import 'server-only'

import { sql } from '@/lib/db/neon'
import { isRateLimited, rateLimitKey } from '@/lib/rateLimit'
import { AiServiceError } from '@/lib/services/aiErrors'

const GEMINI_PROVIDER = 'gemini'
export const SHARED_AI_DAILY_LIMIT = 100
export const SHARED_AI_BURST_LIMIT = 10
export const SHARED_AI_BURST_WINDOW_MS = 60_000

export type SharedAiQuota = {
  limit: number
  remaining: number
  used: number
  resetAt: string
}

type QuotaRow = {
  request_count: number
  reset_at: string | Date
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

async function getResetAt() {
  const rows = (await sql`
    SELECT (CURRENT_DATE + INTERVAL '1 day') AS reset_at
  `) as Array<{ reset_at: string | Date }>
  return toIsoString(rows[0]?.reset_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000))
}

export async function getSharedAiQuota(authUserId: string): Promise<SharedAiQuota> {
  const rows = (await sql`
    SELECT request_count, (CURRENT_DATE + INTERVAL '1 day') AS reset_at
    FROM ai_usage_daily
    WHERE auth_user_id = ${authUserId}
      AND provider = ${GEMINI_PROVIDER}
      AND usage_source = 'shared'
      AND usage_date = CURRENT_DATE
    LIMIT 1
  `) as QuotaRow[]
  const used = rows[0]?.request_count ?? 0
  const resetAt = rows[0]?.reset_at ? toIsoString(rows[0].reset_at) : await getResetAt()

  return {
    limit: SHARED_AI_DAILY_LIMIT,
    used,
    remaining: Math.max(0, SHARED_AI_DAILY_LIMIT - used),
    resetAt,
  }
}

export async function consumeSharedAiQuota(authUserId: string): Promise<SharedAiQuota> {
  if (isRateLimited(
    rateLimitKey('ai-shared-minute', authUserId, null),
    SHARED_AI_BURST_LIMIT,
    SHARED_AI_BURST_WINDOW_MS,
  )) {
    throw new AiServiceError(
      'SHARED_AI_RATE_LIMIT',
      'Demasiadas acciones de AI seguidas con la key compartida. Intenta de nuevo en un minuto o agrega tu API key en /user.',
      429,
      { retryAfterSeconds: 60 },
    )
  }

  const rows = (await sql`
    INSERT INTO ai_usage_daily (
      auth_user_id,
      provider,
      usage_source,
      usage_date,
      request_count,
      created_at,
      updated_at
    )
    VALUES (${authUserId}, ${GEMINI_PROVIDER}, 'shared', CURRENT_DATE, 1, NOW(), NOW())
    ON CONFLICT (auth_user_id, provider, usage_source, usage_date)
    DO UPDATE SET
      request_count = ai_usage_daily.request_count + 1,
      updated_at = NOW()
    WHERE ai_usage_daily.request_count < ${SHARED_AI_DAILY_LIMIT}
    RETURNING request_count, (CURRENT_DATE + INTERVAL '1 day') AS reset_at
  `) as QuotaRow[]

  const row = rows[0]
  if (!row) {
    const quota = await getSharedAiQuota(authUserId)
    throw new AiServiceError(
      'SHARED_AI_DAILY_LIMIT',
      'Agotaste las acciones de AI disponibles hoy con la key compartida. Agrega tu API key Gemini en /user para continuar sin este limite.',
      429,
      { resetAt: quota.resetAt },
    )
  }

  return {
    limit: SHARED_AI_DAILY_LIMIT,
    used: row.request_count,
    remaining: Math.max(0, SHARED_AI_DAILY_LIMIT - row.request_count),
    resetAt: toIsoString(row.reset_at),
  }
}

export async function recordByokAiUsage(authUserId: string) {
  await sql`
    INSERT INTO ai_usage_daily (
      auth_user_id,
      provider,
      usage_source,
      usage_date,
      request_count,
      created_at,
      updated_at
    )
    VALUES (${authUserId}, ${GEMINI_PROVIDER}, 'byok', CURRENT_DATE, 1, NOW(), NOW())
    ON CONFLICT (auth_user_id, provider, usage_source, usage_date)
    DO UPDATE SET
      request_count = ai_usage_daily.request_count + 1,
      updated_at = NOW()
  `
}
