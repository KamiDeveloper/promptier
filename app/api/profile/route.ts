// Profile API — GET returns current user's profile, POST creates/updates it
// Requires: authenticated session (checked server-side via cookie)
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/neon'
import { requireAuth } from '@/lib/auth/requireAuth'
import { z } from 'zod'

const NicknameSchema = z
  .string()
  .trim()
  .min(3, 'Mínimo 3 caracteres')
  .max(32, 'Máximo 32 caracteres')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Solo letras, números, _ y -')

export async function GET(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  const rows = await sql`
    SELECT nickname, created_at
    FROM profiles
    WHERE auth_user_id = ${userId}
    LIMIT 1
  `

  if (rows.length === 0) {
    return NextResponse.json(null)
  }

  return NextResponse.json({ nickname: rows[0].nickname })
}

export async function POST(req: NextRequest) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const parsed = NicknameSchema.safeParse((body as Record<string, unknown>)?.nickname)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Nickname inválido' },
      { status: 422 }
    )
  }

  const nickname = parsed.data
  const normalized = nickname.toLowerCase()

  // Check uniqueness
  const existing = await sql`
    SELECT 1 FROM profiles WHERE lower(nickname) = ${normalized} AND auth_user_id != ${userId} LIMIT 1
  `
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Ese nickname ya está en uso' }, { status: 409 })
  }

  // Upsert
  await sql`
    INSERT INTO profiles (auth_user_id, nickname, created_at, updated_at)
    VALUES (${userId}, ${nickname}, NOW(), NOW())
    ON CONFLICT (auth_user_id)
    DO UPDATE SET nickname = EXCLUDED.nickname, updated_at = NOW()
  `

  return NextResponse.json({ nickname })
}
