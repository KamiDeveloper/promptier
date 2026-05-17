'use client'

import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { Copy, Image as ImageIcon, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ModelPill } from '@/components/models/ModelPill'
import { useAppModal } from '@/components/ui/Modal'
import { useMotionFeedback } from '@/components/ui/MotionProvider'
import { useNetwork } from '@/lib/hooks/useNetwork'
import {
  listPrompts,
  searchPrompts,
  recordCopy,
  toggleFavorite,
  reorderPrompts,
} from '@/lib/db/repositories/promptRepository'
import { createCollection, listCollections } from '@/lib/db/repositories/collectionRepository'
import { listPromptImages } from '@/lib/db/repositories/imageRepository'
import type { LocalCollection, LocalPrompt } from '@/lib/db/schema'

export default function VaultPage() {
  const { offline } = useNetwork()
  const modal = useAppModal()
  const feedback = useMotionFeedback()
  const [prompts, setPrompts] = useState<LocalPrompt[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [filterFav, setFilterFav] = useState(false)
  const [collections, setCollections] = useState<LocalCollection[]>([])
  const [collectionId, setCollectionId] = useState<string>('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const initialLoadRef = useRef(true)
  const loadRequestRef = useRef(0)

  const load = useCallback(async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    if (showLoading) setLoading(true)
    try {
      const results = query
        ? await searchPrompts(query)
        : await listPrompts({
            isFavorite: filterFav || undefined,
            collectionId: collectionId || undefined,
          })
      const nextCollections = await listCollections()
      if (loadRequestRef.current !== requestId) return
      setPrompts(results)
      setCollections(nextCollections)
      setHasLoaded(true)
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false)
    }
  }, [query, filterFav, collectionId])

  useEffect(() => {
    const showLoading = initialLoadRef.current
    initialLoadRef.current = false
    void load({ showLoading })
  }, [load])

  async function handleCopy(prompt: LocalPrompt) {
    await navigator.clipboard.writeText(prompt.content)
    await recordCopy(prompt.localId)
    setPrompts((current) => current.map((item) => (
      item.localId === prompt.localId
        ? { ...item, copyCount: item.copyCount + 1, lastCopiedAt: new Date() }
        : item
    )))
    feedback.notify({ title: 'Prompt copiado', message: prompt.title || 'Contenido listo en el portapapeles.' })
  }

  async function handleToggleFav(localId: string) {
    const currentPrompt = prompts.find((prompt) => prompt.localId === localId)
    const nextFavorite = !currentPrompt?.isFavorite
    const previousPrompts = prompts

    setPrompts((current) => current.flatMap((prompt) => {
      if (prompt.localId !== localId) return [prompt]
      const updated = { ...prompt, isFavorite: nextFavorite, updatedAt: new Date() }
      return filterFav && !nextFavorite ? [] : [updated]
    }))

    try {
      await toggleFavorite(localId)
      feedback.notify({ title: 'Favoritos actualizados', durationMs: 1800 })
      await load({ showLoading: false })
    } catch {
      setPrompts(previousPrompts)
      feedback.notify({ title: 'No se pudo actualizar favoritos', tone: 'warning', durationMs: 2200 })
    }
  }

  async function handleCreateCollection() {
    const name = await modal.prompt({
      title: 'Nueva coleccion',
      label: 'Nombre de la coleccion',
      placeholder: 'Editorial, Producto, Referencias...',
      confirmLabel: 'Crear',
      maxLength: 80,
      validate: (value) => value.length < 2 ? 'Usa al menos 2 caracteres.' : null,
    })
    if (!name?.trim()) return
    await createCollection(name.trim())
    feedback.notify({ title: 'Coleccion creada', message: name.trim() })
    await load({ showLoading: false })
  }

  async function handleDrop(targetLocalId: string) {
    if (!draggingId || draggingId === targetLocalId) return
    const next = [...prompts]
    const from = next.findIndex((item) => item.localId === draggingId)
    const to = next.findIndex((item) => item.localId === targetLocalId)
    if (from < 0 || to < 0) return
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setPrompts(next)
    setDraggingId(null)
    await reorderPrompts(next.map((item) => item.localId))
    feedback.notify({ title: 'Orden actualizado', durationMs: 1800 })
  }

  return (
    <section className="motion-page">
      {modal.modalNode}

      <div className="mb-32 flex flex-col gap-16">
        <div className="flex flex-wrap items-center justify-between gap-16">
          <h1 className="text-[20px] font-bold uppercase tracking-widest text-ghost-white">
            Vault
          </h1>
          <Link href="/vault/new">
            <Button variant="primary" size="sm">+ Nuevo prompt</Button>
          </Link>
        </div>

        <Input
          placeholder="Buscar por titulo, modelo, contenido o etiqueta..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar prompts"
        />

        <div className="flex flex-wrap gap-8">
          <Button
            variant={filterFav ? 'filled' : 'ghost'}
            size="sm"
            onClick={() => setFilterFav((value) => !value)}
            aria-pressed={filterFav}
          >
            * Favoritos
          </Button>
          {offline && (
            <Badge variant="offline">
              <span aria-hidden="true">o</span> offline - vault disponible
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={handleCreateCollection}>
            + Coleccion
          </Button>
          {collections.map((collection) => (
            <Button
              key={collection.localId}
              variant={collectionId === collection.localId ? 'filled' : 'ghost'}
              size="sm"
              onClick={() => setCollectionId((current) => current === collection.localId ? '' : collection.localId)}
              aria-pressed={collectionId === collection.localId}
            >
              {collection.name}
            </Button>
          ))}
        </div>
      </div>

      {loading && !hasLoaded ? (
        <div className="grid gap-16" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="motion-skeleton h-83 rounded-(--radius-card)"
              style={{ '--motion-index': index } as CSSProperties}
            />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <EmptyState hasQuery={!!query} />
      ) : (
        <ul
          className="motion-list grid gap-16"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}
          role="list"
        >
          {prompts.map((prompt, index) => (
            <li
              key={prompt.localId}
              draggable
              onDragStart={() => setDraggingId(prompt.localId)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void handleDrop(prompt.localId)}
              className={draggingId === prompt.localId ? 'opacity-50' : ''}
              style={{ '--motion-index': index } as CSSProperties}
            >
              <PromptCard
                prompt={prompt}
                onCopy={() => handleCopy(prompt)}
                onToggleFav={() => handleToggleFav(prompt.localId)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PromptCard({
  prompt,
  onCopy,
  onToggleFav,
}: {
  prompt: LocalPrompt
  onCopy: () => void
  onToggleFav: () => void
}) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function loadCover() {
      const images = await listPromptImages(prompt.localId)
      const cover = images
        .filter((image) => image.originalBlob || image.optimizedBlob || image.remoteUrl)
        .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))[0]

      if (!cover) {
        if (!cancelled) setCoverUrl(null)
        return
      }

      if (cover.remoteUrl?.startsWith('data:image/')) {
        if (!cancelled) setCoverUrl(cover.remoteUrl)
        return
      }

      const blob = cover.optimizedBlob ?? cover.originalBlob
      if (!blob) {
        if (!cancelled) setCoverUrl(null)
        return
      }

      objectUrl = URL.createObjectURL(blob)
      if (!cancelled) setCoverUrl(objectUrl)
    }

    void loadCover()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [prompt.localId])

  const typeLabel = getPromptTypeLabel(prompt.type)
  const snippet = (prompt.description || prompt.content).replace(/\s+/g, ' ').trim()
  const visibleTags = prompt.tags.slice(0, 3)

  return (
    <Card interactive padded={false} className="group overflow-hidden">
      <div className="relative h-75 overflow-hidden border-b border-muted-ash bg-midnight-oil sm:h-60 lg:h-65">
        <Link
          href={`/vault/${prompt.localId}`}
          className="absolute inset-0 z-10"
          aria-label={`Abrir ${prompt.title || 'prompt sin titulo'}`}
        />

        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover opacity-95 transition duration-300 group-hover:scale-[1.015] group-hover:opacity-100"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-steel-gray),var(--color-midnight-oil))]">
            <div className="flex h-16 w-16 items-center justify-center rounded-(--radius-button) border border-muted-ash text-dim-gray">
              <ImageIcon size={26} aria-hidden="true" />
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.08)_42%,rgba(0,0,0,0.86)_100%)]" />

        <div className="absolute right-[8px] top-[8px] z-20 flex gap-8">
          <IconActionButton
            label="Copiar prompt"
            onClick={onCopy}
          >
            <Copy size={17} aria-hidden="true" />
          </IconActionButton>
          <IconActionButton
            label={prompt.isFavorite ? 'Quitar de favoritos' : 'Anadir a favoritos'}
            onClick={onToggleFav}
            pressed={prompt.isFavorite}
          >
            <Star size={18} fill={prompt.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </IconActionButton>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 p-16">
          <h2
            className="line-clamp-2 max-w-[calc(100%-96px)] text-[18px] font-bold leading-tight text-ghost-white sm:text-[20px]"
            title={prompt.title || 'Sin titulo'}
          >
            {prompt.title || <span className="italic text-dim-gray">Sin titulo</span>}
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-[8px] p-16">
        <div className="flex flex-wrap items-center gap-6">
          <Pill>{typeLabel}</Pill>
          <ModelPill model={prompt.model} />
          {visibleTags.map((tag) => (
            <Pill key={tag}>{tag}</Pill>
          ))}
          {prompt.syncStatus === 'conflict' && <Badge variant="conflict">conflicto</Badge>}
          {prompt.syncStatus === 'pending_upload' && <Badge variant="pending">pendiente</Badge>}
        </div>

        <Link
          href={`/vault/${prompt.localId}`}
          className="motion-press line-clamp-2 text-[13px] leading-relaxed text-dim-gray hover:text-ghost-white"
        >
          {snippet || 'Sin descripcion todavia.'}
        </Link>
      </div>
    </Card>
  )
}

function getPromptTypeLabel(type: LocalPrompt['type']) {
  const labels: Record<LocalPrompt['type'], string> = {
    image_generation: 'Generación',
    image_editing: 'Edición',
    other: 'Otro',
  }
  return labels[type]
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-(--radius-button) border border-muted-ash px-8 py-5 text-[11px] font-bold leading-none text-ghost-white">
      {children}
    </span>
  )
}

function IconActionButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string
  onClick: () => void
  pressed?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="motion-press flex h-10 w-10 items-center justify-center rounded-(--radius-button) border border-muted-ash bg-midnight-oil/80 text-ghost-white backdrop-blur-sm hover:border-ghost-white"
    >
      {children}
    </button>
  )
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="motion-panel flex flex-col items-center gap-16 py-32 text-center font-terminal text-dim-gray">
      <span className="motion-loading-dots text-[40px]" aria-hidden="true">□</span>
      <p className="text-[14px]">
        {hasQuery ? 'Sin resultados para esa busqueda.' : 'Tu vault esta vacio.'}
      </p>
      {!hasQuery && (
        <Link href="/vault/new">
          <Button variant="ghost" size="sm">Crear primer prompt</Button>
        </Link>
      )}
    </div>
  )
}
