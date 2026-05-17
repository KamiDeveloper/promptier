// DELETE /api/public/:id - unpublish a public prompt owned by the current user.
import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/neon'
import { requireAuth } from '@/lib/auth/requireAuth'
import { z } from 'zod'

const PublicPromptIdSchema = z.string().uuid()

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const [userId, errRes] = await requireAuth(req)
  if (errRes) return errRes

  const { id } = await context.params
  if (!PublicPromptIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  const rows = await sql`
    SELECT author_user_id, is_deleted
    FROM public_prompts
    WHERE id = ${id}
    LIMIT 1
  `

  if (rows.length === 0 || rows[0].is_deleted) {
    return NextResponse.json({ error: 'Prompt publico no encontrado' }, { status: 404 })
  }

  if (rows[0].author_user_id !== userId) {
    return NextResponse.json({ error: 'No puedes eliminar un prompt que no publicaste.' }, { status: 403 })
  }

  await sql`
    UPDATE public_prompts
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE id = ${id} AND author_user_id = ${userId} AND is_deleted = FALSE
  `

  return new NextResponse(null, { status: 204 })
}
