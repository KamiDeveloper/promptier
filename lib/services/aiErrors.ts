export type AiErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_PROVIDER_ERROR'
  | 'GEMINI_KEY_INVALID'
  | 'GEMINI_KEY_REQUIRED'
  | 'GEMINI_KEY_FORBIDDEN'
  | 'SHARED_AI_DAILY_LIMIT'
  | 'SHARED_AI_RATE_LIMIT'

export class AiServiceError extends Error {
  readonly code: AiErrorCode
  readonly status: number
  readonly resetAt?: string
  readonly retryAfterSeconds?: number

  constructor(
    code: AiErrorCode,
    message: string,
    status = 502,
    options: { resetAt?: string; retryAfterSeconds?: number } = {},
  ) {
    super(message)
    this.name = 'AiServiceError'
    this.code = code
    this.status = status
    this.resetAt = options.resetAt
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

export function normalizeAiError(err: unknown) {
  if (err instanceof AiServiceError) {
    return {
      status: err.status,
      body: {
        error: err.message,
        code: err.code,
        resetAt: err.resetAt,
      },
      retryAfterSeconds: err.retryAfterSeconds,
    }
  }

  return {
    status: 502,
    body: {
      error: 'No se pudo completar la accion de AI. Revisa tu configuracion de Gemini o intenta de nuevo.',
      code: 'AI_PROVIDER_ERROR' as AiErrorCode,
    },
    retryAfterSeconds: undefined,
  }
}
