'use client'

import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

function getAuthBaseUrl() {
  if (typeof window !== 'undefined') {
    return new URL('/api/auth', window.location.origin).toString()
  }

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const appUrl = configuredAppUrl.startsWith('http')
    ? configuredAppUrl
    : `https://${configuredAppUrl}`

  return new URL('/api/auth', appUrl).toString()
}

// Browser calls go through the local Next.js auth proxy so cookies belong to this app.
// The proxy uses NEON_AUTH_BASE_URL server-side to talk to Neon Auth.
export const authClient = createAuthClient(getAuthBaseUrl(), {
  adapter: BetterAuthReactAdapter(),
})
