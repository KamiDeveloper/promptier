import 'server-only'

import { getSharedAiQuota } from '@/lib/services/aiUsageService'
import { getGeminiKeyMetadata } from '@/lib/services/userAiKeyService'

export async function getUserAiSettings(authUserId: string) {
  const [metadata, sharedQuota] = await Promise.all([
    getGeminiKeyMetadata(authUserId),
    getSharedAiQuota(authUserId),
  ])

  return {
    ...metadata,
    sharedQuotaRemaining: sharedQuota.remaining,
    sharedQuotaLimit: sharedQuota.limit,
    sharedQuotaUsed: sharedQuota.used,
    sharedQuotaResetAt: sharedQuota.resetAt,
  }
}
