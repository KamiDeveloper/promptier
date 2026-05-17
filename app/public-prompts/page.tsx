import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { sql } from '@/lib/db/neon'
import { getCurrentUserId } from '@/lib/auth/requireAuth'
import { PublicFeedResponseSchema } from '@/lib/schemas/sync'
import { PrompterestFeed } from './PrompterestFeed'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Prompterest',
  description: 'Feed publico visual tipo masonry con prompts de imagen compartidos por la comunidad Promptier.',
  alternates: {
    canonical: '/public-prompts',
  },
  openGraph: {
    title: 'Prompterest | Promptier',
    description: 'Explora prompts visuales compartidos por la comunidad Promptier.',
    url: '/public-prompts',
    siteName: 'Promptier',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prompterest | Promptier',
    description: 'Explora prompts visuales compartidos por la comunidad Promptier.',
  },
}

const PAGE_SIZE = 25

export default async function PublicPromptsPage() {
  const viewerUserId = await getCurrentUserId()
  const rows = await sql`
    SELECT
      id,
      author_user_id,
      author_nickname,
      title,
      description,
      content,
      content_type,
      type,
      model,
      tags,
      optimized_image_url,
      published_at
    FROM public_prompts
    WHERE is_deleted = FALSE
    ORDER BY published_at DESC, id DESC
    LIMIT ${PAGE_SIZE}
  `

  const nextCursor =
    rows.length === PAGE_SIZE
      ? `${new Date(rows[rows.length - 1].published_at as string).toISOString()}|${rows[rows.length - 1].id as string}`
      : null

  const initialFeed = PublicFeedResponseSchema.parse({
    prompts: rows.map((row) => ({
      id: row.id,
      authorNickname: row.author_nickname,
      title: row.title,
      description: row.description,
      content: row.content,
      contentType: row.content_type,
      type: row.type,
      model: row.model,
      tags: row.tags,
      optimizedImageUrl: row.optimized_image_url ?? undefined,
      ownedByViewer: viewerUserId ? row.author_user_id === viewerUserId : false,
      publishedAt: new Date(row.published_at as string).toISOString(),
      cursorValue: `${new Date(row.published_at as string).toISOString()}|${row.id}`,
    })),
    nextCursor,
    hasMore: nextCursor !== null,
  })

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main
        className="flex-1 w-full mx-auto px-16 py-32"
        style={{ maxWidth: 'var(--page-max-width)' }}
      >
        <PrompterestFeed initialFeed={initialFeed} />
      </main>
    </div>
  )
}
