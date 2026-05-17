import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Reads the authenticated user id from the Neon Auth session cookie.
 * Returns null if not authenticated.
 */
export async function getCurrentUserId(_req?: NextRequest): Promise<string | null> {
  try {
    const { data: session } = await auth.getSession()
    return session?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Throws a 401 NextResponse if the request is not authenticated.
 * Returns the user id string on success.
 * Usage:
 *   const [userId, errResponse] = await requireAuth(req)
 *   if (errResponse) return errResponse
 */
export async function requireAuth(
  req: NextRequest
): Promise<[string, null] | [null, NextResponse]> {
  const userId = await getCurrentUserId(req)
  if (!userId) {
    return [null, NextResponse.json({ error: 'No autenticado' }, { status: 401 })]
  }
  return [userId, null]
}
