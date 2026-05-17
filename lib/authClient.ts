'use client'

import { createAuthClient } from '@neondatabase/auth'
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Browser calls go through the local Next.js auth proxy so cookies belong to this app.
// The proxy uses NEON_AUTH_BASE_URL server-side to talk to Neon Auth.
export const authClient = createAuthClient(new URL('/api/auth', appUrl).toString(), {
  adapter: BetterAuthReactAdapter(),
})
