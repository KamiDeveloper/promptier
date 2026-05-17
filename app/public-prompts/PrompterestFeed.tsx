'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Bookmark, Check, Copy, RefreshCw, Search, Trash2 } from 'lucide-react'
import { authClient } from '@/lib/authClient'
import { useNetwork } from '@/lib/hooks/useNetwork'
import { getDb } from '@/lib/db/database'
import type { LocalPublicPromptCache } from '@/lib/db/schema'
import type { PublicFeedResponse, PublicPrompt } from '@/lib/schemas/sync'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAppModal } from '@/components/ui/Modal'
import { useMotionFeedback } from '@/components/ui/MotionProvider'
import { ModelPill } from '@/components/models/ModelPill'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'

type Props = {
  initialFeed: PublicFeedResponse
}

const skeletonHeights = [320, 460, 260, 390, 520, 300, 430, 350, 580, 280, 410, 500]

function toPublicPromptCache(prompt: PublicPrompt): LocalPublicPromptCache {
  const publishedAt = new Date(prompt.publishedAt)

  return {
    remoteId: prompt.id,
    title: prompt.title,
    content: prompt.content,
    contentType: prompt.contentType,
    authorNickname: prompt.authorNickname,
    tags: prompt.tags,
    type: prompt.type,
    model: prompt.model,
    optimizedImageUrl: prompt.optimizedImageUrl,
    cachedAt: new Date(),
    publishedAt,
    cursorValue: `${publishedAt.toISOString()}|${prompt.id}`,
  }
}

export function PrompterestFeed({ initialFeed }: Props) {
  const { data: session } = authClient.useSession()
  const { online } = useNetwork()
  const feedback = useMotionFeedback()
  const modal = useAppModal()
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [prompts, setPrompts] = useState<PublicPrompt[]>(initialFeed.prompts)
  const [cursor, setCursor] = useState<string | null>(initialFeed.nextCursor)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingNew, setCheckingNew] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)

  useEffect(() => {
    const db = getDb()
    void db.publicPromptCache.bulkPut(initialFeed.prompts.map(toPublicPromptCache)).catch(() => {})
  }, [initialFeed.prompts])

  useEffect(() => {
    if (!activeCardId) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[data-prompterest-card]')) setActiveCardId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [activeCardId])

  const filteredPrompts = prompts.filter((prompt) => {
    const value = query.trim().toLowerCase()
    if (!value) return true
    return [
      prompt.title,
      prompt.description,
      prompt.content,
      prompt.model ?? '',
      prompt.authorNickname,
      ...prompt.tags,
    ].some((field) => field.toLowerCase().includes(value))
  })

  const loadMore = useCallback(async () => {
    if (!cursor || !online || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/public?cursor=${encodeURIComponent(cursor)}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json() as PublicFeedResponse
      setPrompts((current) => {
        const existing = new Set(current.map((prompt) => prompt.id))
        const fresh = data.prompts.filter((prompt) => !existing.has(prompt.id))
        return [...current, ...fresh]
      })
      setCursor(data.nextCursor)
      const db = getDb()
      await db.publicPromptCache.bulkPut(data.prompts.map(toPublicPromptCache))
    } finally {
      setLoading(false)
    }
  }, [cursor, loading, online])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !cursor) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore()
    }, { rootMargin: '900px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [cursor, loadMore])

  const checkForNew = async () => {
    if (!online) {
      feedback.notify({ title: 'Sin conexion', message: 'Prompterest sigue disponible desde cache local.', tone: 'warning' })
      return
    }
    setCheckingNew(true)
    try {
      const newestCursor = prompts[0] ? `${prompts[0].publishedAt}|${prompts[0].id}` : null
      const url = newestCursor
        ? `/api/public/recent?cursor=${encodeURIComponent(newestCursor)}`
        : '/api/public/recent'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json() as { count: number; hasNew: boolean; prompts: PublicPrompt[] }
      if (data.prompts.length === 0) {
        feedback.notify({ title: 'Sin novedades', message: 'Ya estas viendo lo mas reciente.' })
        return
      }
      setPrompts((current) => {
        const existing = new Set(current.map((prompt) => prompt.id))
        const fresh = data.prompts.filter((prompt) => !existing.has(prompt.id))
        return [...fresh, ...current]
      })
      const db = getDb()
      await db.publicPromptCache.bulkPut(data.prompts.map(toPublicPromptCache))
      feedback.notify({ title: `${data.count} nuevos`, message: 'Prompterest se actualizo arriba.', tone: 'success' })
    } finally {
      setCheckingNew(false)
    }
  }

  const copyPrompt = async (prompt: PublicPrompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content)
      setCopiedId(prompt.id)
      feedback.notify({ title: 'Prompt copiado', message: prompt.title || 'Listo para pegar.' })
      setTimeout(() => setCopiedId(null), 1800)
    } catch {
      feedback.notify({ title: 'No se pudo copiar', tone: 'danger' })
    }
  }

  const saveToVault = async (prompt: PublicPrompt) => {
    try {
      const { createPrompt } = await import('@/lib/db/repositories/promptRepository')
      const { addOptimizedPromptImageFromDataUrl } = await import('@/lib/db/repositories/imageRepository')
      const createdPrompt = await createPrompt({
        title: `[Prompterest] ${prompt.title}`,
        description: prompt.description,
        content: prompt.content,
        contentType: prompt.contentType,
        type: prompt.type,
        model: prompt.model,
        tags: [...prompt.tags, 'prompterest'],
      })

      let imageSaved = false
      if (prompt.optimizedImageUrl?.startsWith('data:image/')) {
        await addOptimizedPromptImageFromDataUrl(createdPrompt.localId, prompt.optimizedImageUrl)
        imageSaved = true
      }

      setSavedIds((current) => {
        const next = new Set(current)
        next.add(prompt.id)
        return next
      })
      feedback.notify({
        title: 'Guardado en Vault',
        message: imageSaved ? 'Prompt e imagen optimizada agregados.' : (prompt.title || 'Prompt publico agregado.'),
      })
    } catch {
      feedback.notify({
        title: 'No se pudo guardar',
        message: 'Intenta de nuevo desde Prompterest.',
        tone: 'danger',
      })
    }
  }

  const deletePublicPrompt = async (prompt: PublicPrompt) => {
    const confirmed = await modal.confirm({
      title: 'Cancelar publicacion',
      message: 'Este prompt dejara de aparecer en Prompterest. Tu copia privada en el Vault no se elimina.',
      confirmLabel: 'Eliminar publico',
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const res = await fetch(`/api/public/${encodeURIComponent(prompt.id)}`, {
        method: 'DELETE',
        cache: 'no-store',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        feedback.notify({
          title: 'No se pudo eliminar',
          message: body.error ?? 'Revisa la sesion e intenta de nuevo.',
          tone: res.status === 403 ? 'warning' : 'danger',
        })
        return
      }

      setPrompts((current) => current.filter((item) => item.id !== prompt.id))
      setSavedIds((current) => {
        const next = new Set(current)
        next.delete(prompt.id)
        return next
      })
      const db = getDb()
      await db.publicPromptCache.where('remoteId').equals(prompt.id).delete().catch(() => {})
      feedback.notify({ title: 'Publicacion eliminada', message: 'Ya no aparece en Prompterest.', tone: 'success' })
    } catch {
      feedback.notify({ title: 'No se pudo eliminar', message: 'Intenta de nuevo en unos segundos.', tone: 'danger' })
    }
  }

  return (
    <section className="motion-page">
      {modal.modalNode}

      <div className="mb-10 flex flex-col gap-16 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-[28px] font-bold uppercase tracking-widest text-ghost-white">Prompterest</h1>
          <p className="mt-6 text-[13px] leading-relaxed text-dim-gray">
            Explora prompts visuales compartidos nuestra comunidad. Ahora mismo hay <span className="tabular-nums">{filteredPrompts.length}</span> prompt{filteredPrompts.length === 1 ? '' : 's'}, con tú ayúda habrán muchos más.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={checkForNew} loading={checkingNew} disabled={!online || checkingNew}>
          <RefreshCw size={16} aria-hidden="true" />
          <span>Ver recientes</span>
        </Button>
      </div>

      <div className="mb-10 grid gap-12 md:grid-cols-[minmax(0,520px)_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-16 top-1/2 z-10 -translate-y-1/2 text-dim-gray" size={16} aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por titulo, modelo, tag o autor..."
            aria-label="Buscar en Prompterest"
            className="pl-40"
          />
        </div>
      </div>

      {filteredPrompts.length === 0 ? (
        <Card className="flex flex-col items-center gap-12 text-center">
          <MascotAnimation variant="greeting" size="lg" crop="tight" />
          <p className="text-[13px] text-dim-gray">
            {query ? 'No hay resultados para esa busqueda.' : 'Aun no hay prompts publicos.'}
          </p>
        </Card>
      ) : (
        <div className="columns-2 gap-8 md:gap-16 sm:columns-2 lg:columns-3 2xl:columns-5 [column-fill:balance]">
          {filteredPrompts.map((prompt, index) => (
            <PrompterestCard
              key={prompt.id}
              prompt={prompt}
              index={index}
              authenticated={!!session?.user}
              copied={copiedId === prompt.id}
              saved={savedIds.has(prompt.id)}
              revealed={activeCardId === prompt.id}
              onActivate={() => setActiveCardId(prompt.id)}
              onCopy={() => copyPrompt(prompt)}
              onSave={() => saveToVault(prompt)}
              onDelete={() => deletePublicPrompt(prompt)}
            />
          ))}
          {loading && <MasonrySkeleton />}
        </div>
      )}

      <div ref={loadMoreRef} className="h-16" aria-hidden="true" />
      {cursor && (
        <div className="mt-24 flex justify-center">
          <Button variant="ghost" onClick={loadMore} loading={loading} disabled={!online || loading}>
            Cargar mas
          </Button>
        </div>
      )}
    </section>
  )
}

function PrompterestCard({
  prompt,
  index,
  authenticated,
  copied,
  saved,
  revealed,
  onActivate,
  onCopy,
  onSave,
  onDelete,
}: {
  prompt: PublicPrompt
  index: number
  authenticated: boolean
  copied: boolean
  saved: boolean
  revealed: boolean
  onActivate: () => void
  onCopy: () => void
  onSave: () => void
  onDelete: () => void
}) {
  const summary = (prompt.description || prompt.content).replace(/\s+/g, ' ').trim()
  const visibleTags = prompt.tags.slice(0, 4)

  return (
    <article
      data-prompterest-card
      data-revealed={revealed || undefined}
      onClick={onActivate}
      className="motion-panel group mb-16 break-inside-avoid cursor-pointer overflow-hidden rounded-(--radius-card) border border-muted-ash bg-steel-gray md:cursor-default"
      style={{ '--motion-index': index } as CSSProperties}
    >
      {prompt.optimizedImageUrl ? (
        <div className="relative overflow-hidden border-b border-muted-ash bg-midnight-oil">
          <img
            src={prompt.optimizedImageUrl}
            alt={prompt.title || 'Prompt publico'}
            className="block h-auto w-full transition duration-300 group-hover:opacity-95"
            loading="lazy"
            decoding="async"
          />
          <div
            className={[
              'pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.02)_42%,rgba(0,0,0,0.86)_100%)] opacity-0 transition-opacity duration-200 ease-out md:opacity-100',
              revealed ? 'opacity-100' : '',
            ].join(' ')}
          />
          <CardActions
            authenticated={authenticated}
            copied={copied}
            saved={saved}
            canDelete={!!prompt.ownedByViewer}
            revealed={revealed}
            onCopy={onCopy}
            onSave={onSave}
            onDelete={onDelete}
          />
          <div
            className={[
              'absolute inset-x-0 bottom-0 z-20 translate-y-3 p-4 opacity-0 transition-[opacity,transform] duration-200 ease-out md:translate-y-0 md:p-16 md:opacity-100',
              revealed ? 'translate-y-0 opacity-100' : 'pointer-events-none md:pointer-events-auto',
            ].join(' ')}
          >
            <h2
              className="max-w-full wrap-break-word text-[12px] font-bold leading-tight text-ghost-white md:line-clamp-2 md:max-w-[calc(100%-96px)] md:text-[18px]"
              title={prompt.title || 'Sin titulo'}
            >
              {prompt.title || 'Sin titulo'}
            </h2>
          </div>
        </div>
      ) : (
        <div className="relative min-h-33 border-b border-muted-ash bg-[linear-gradient(135deg,var(--color-steel-gray),var(--color-midnight-oil))] p-16">
          <CardActions
            authenticated={authenticated}
            copied={copied}
            saved={saved}
            canDelete={!!prompt.ownedByViewer}
            revealed={revealed}
            onCopy={onCopy}
            onSave={onSave}
            onDelete={onDelete}
          />
          <div
            className={[
              'translate-y-3 opacity-0 transition-[opacity,transform] duration-200 ease-out md:translate-y-0 md:opacity-100',
              revealed ? 'translate-y-0 opacity-100' : 'pointer-events-none md:pointer-events-auto',
            ].join(' ')}
          >
            <h2
              className="max-w-full wrap-break-word text-[12px] font-bold leading-tight text-ghost-white md:line-clamp-3 md:max-w-[calc(100%-96px)] md:text-[18px]"
              title={prompt.title || 'Sin titulo'}
            >
              {prompt.title || 'Sin titulo'}
            </h2>
          </div>
        </div>
      )}

      <div className=" p-2 md:space-y-2">

        <div className="flex flex-wrap justify-between gap-6">
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <TypePill>{getPromptTypeLabel(prompt.type)}</TypePill>
            <ModelPill model={prompt.model} size="xs" />
          </div>
          <div className="flex min-w-0 items-center gap-3 text-[9px] text-dim-gray md:gap-5 md:text-[11px]">
            <span className="truncate">{prompt.authorNickname}</span>
            <span>/</span>
            <span>{formatStableDate(prompt.publishedAt)}</span>
        </div>
        </div>

        {visibleTags.length > 0 && (
          <div
            className={[
              'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out md:block md:overflow-visible md:opacity-100',
              revealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 md:grid-rows-none md:opacity-100',
            ].join(' ')}
          >
            <div className={['flex min-h-0 flex-wrap gap-1.5 overflow-hidden md:gap-6 md:overflow-visible md:pt-0', revealed ? ' mt-2 ' : ' mt-0 '].join(' ')}>
              {visibleTags.map((tag) => (
                <Pill key={tag}>{tag}</Pill>
              ))}
            </div>
          </div>
        )}

        {summary && (
          <div
            className={[
              'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out lg:grid-rows-[0fr] lg:opacity-100 lg:group-hover:grid-rows-[1fr]',
              revealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 lg:opacity-100',
            ].join(' ')}
          >
            <p className={['min-h-0 overflow-hidden text-[10px] leading-relaxed text-dim-gray md:pt-0 md:text-[11px] lg:line-clamp-3 lg:text-[12px]', revealed ? ' mt-1 ' : ' mt-0 ' ].join("")}>
              {summary}
            </p>
          </div>
        )}
      </div>
    </article>
  )
}

function CardActions({
  authenticated,
  copied,
  saved,
  canDelete,
  revealed,
  onCopy,
  onSave,
  onDelete,
}: {
  authenticated: boolean
  copied: boolean
  saved: boolean
  canDelete: boolean
  revealed: boolean
  onCopy: () => void
  onSave: () => void
  onDelete: () => void
}) {
  const actions = [
    {
      key: 'copy',
      label: copied ? 'Prompt copiado' : 'Copiar prompt',
      onClick: onCopy,
      pressed: copied,
      icon: copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />,
    },
    {
      key: 'save',
      label: authenticated ? (saved ? 'Guardado en Vault' : 'Guardar en Vault') : 'Inicia sesion para guardar',
      onClick: onSave,
      disabled: !authenticated || saved,
      pressed: saved,
      icon: saved ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />,
    },
    ...(canDelete
      ? [{
          key: 'delete',
          label: 'Eliminar de Prompterest',
          onClick: onDelete,
          danger: true,
          icon: <Trash2 size={17} aria-hidden="true" />,
        }]
      : []),
  ]

  return (
    <div
      className={[
        'absolute right-6 top-6 z-30 flex gap-6 md:right-[8px] md:top-[8px] md:gap-8',
        revealed ? 'pointer-events-auto' : 'pointer-events-none md:pointer-events-auto',
      ].join(' ')}
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action, actionIndex) => (
        <IconActionButton
          key={action.key}
          label={action.label}
          onClick={action.onClick}
          disabled={action.disabled}
          pressed={action.pressed}
          danger={action.danger}
          revealed={revealed}
          actionIndex={actionIndex}
          actionCount={actions.length}
        >
          {action.icon}
        </IconActionButton>
      ))}
    </div>
  )
}

function IconActionButton({
  label,
  onClick,
  disabled,
  pressed,
  danger,
  revealed,
  actionIndex,
  actionCount,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
  danger?: boolean
  revealed: boolean
  actionIndex: number
  actionCount: number
  children: ReactNode
}) {
  const mobileOffset = `${(actionCount - actionIndex - 1) * 42}px`
  const mobileDelay = revealed ? `${actionIndex * 34}ms` : `${(actionCount - actionIndex - 1) * 24}ms`

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || undefined}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      style={{
        '--mobile-action-offset': mobileOffset,
        transitionDelay: mobileDelay,
      } as CSSProperties}
      className={[
        'motion-press flex h-9 w-9 items-center justify-center rounded-(--radius-button) border bg-midnight-oil/80 text-ghost-white backdrop-blur-sm transition-[opacity,transform,border-color,background-color,color] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40 md:h-10 md:w-10 md:translate-x-0 md:opacity-100',
        revealed ? 'translate-x-0 opacity-100' : 'translate-x-(--mobile-action-offset) opacity-0',
        danger ? 'border-dim-gray hover:border-ghost-white' : 'border-muted-ash hover:border-ghost-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-(--radius-button) border border-muted-ash px-6 py-2 text-[9px] font-bold leading-none text-ghost-white md:px-8 md:py-5 md:text-[11px]">
      {children}
    </span>
  )
}

function TypePill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-(--radius-button) border border-ghost-white/75 bg-dim-gray/25 px-6 py-2 text-[9px] font-bold leading-none text-ghost-white md:px-8 md:py-5 md:text-[11px]">
      {children}
    </span>
  )
}

function getPromptTypeLabel(type: PublicPrompt['type']) {
  const labels: Record<PublicPrompt['type'], string> = {
    image_generation: 'Generación',
    image_editing: 'Edición',
    other: 'Otro',
  }
  return labels[type]
}

function formatStableDate(value: string) {
  return new Date(value).toISOString().slice(0, 10)
}

function MasonrySkeleton() {
  return (
    <>
      {skeletonHeights.slice(0, 8).map((height, index) => (
        <div
          key={`${height}-${index}`}
          className="motion-skeleton mb-16 break-inside-avoid rounded-(--radius-card)"
          style={{ height }}
        />
      ))}
    </>
  )
}
