// Neon Auth (Better Auth) — SERVER ONLY
// Docs: https://neon.com/docs/auth/quick-start/nextjs-api-only
// Users/sessions are stored in the `neon_auth` schema of your Neon database.
// Google OAuth is configured in the Neon Console — no GOOGLE_CLIENT_* env vars needed.
import { createNeonAuth } from '@neondatabase/auth/next/server'

if (!process.env.NEON_AUTH_BASE_URL) {
  throw new Error('NEON_AUTH_BASE_URL environment variable is not set.')
}
if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error('NEON_AUTH_COOKIE_SECRET environment variable is not set.')
}

export const auth = createNeonAuth({
  baseUrl:  process.env.NEON_AUTH_BASE_URL,
  cookies:  { secret: process.env.NEON_AUTH_COOKIE_SECRET },
})

// Re-export type helpers for use in Server Components and Route Handlers
export type { BetterAuthSession as Session } from '@neondatabase/auth/types'
