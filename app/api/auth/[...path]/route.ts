// Neon Auth route handler — catches all /api/auth/* requests
// Handles: sign-in, sign-out, get-session, OAuth callbacks, etc.
import { auth } from '@/lib/auth'

export const { GET, POST } = auth.handler()
