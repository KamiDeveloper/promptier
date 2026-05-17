'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type UIEvent,
  type WheelEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Star,
  Trash2,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAppModal } from '@/components/ui/Modal'
import { useMotionFeedback } from '@/components/ui/MotionProvider'
import { ModelPill } from '@/components/models/ModelPill'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'
import {
  deletePromptImage,
  getBestImageUrl,
  listAllPromptImages,
  updatePromptImageDimensions,
} from '@/lib/db/repositories/imageRepository'
import { listCollections } from '@/lib/db/repositories/collectionRepository'
import {
  getPromptByLocalId,
  recordCopy,
  toggleFavorite,
} from '@/lib/db/repositories/promptRepository'
import type { LocalPrompt } from '@/lib/db/schema'

type OrientationFilter = 'all' | 'portrait' | 'landscape' | 'square' | 'panorama'
type TiltState = 'unknown' | 'enabled' | 'dismissed' | 'denied' | 'unavailable'

type GalleryItem = {
  id: string
  promptLocalId: string
  promptTitle: string
  promptContent: string
  promptDescription?: string
  promptType: LocalPrompt['type']
  model?: string
  tags: string[]
  collectionName?: string
  isFavorite: boolean
  syncStatus: LocalPrompt['syncStatus'] | 'orphan'
  url: string
  width?: number
  height?: number
  mimeType: string
  createdAt: Date
  storageLabel: string
}

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

const TILT_STORAGE_KEY = 'promptier.gallery.tilt'
const CONSENT_STORAGE_KEY = 'promptier.gallery.tiltConsent'

const orientationFilters: Array<{ value: OrientationFilter; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'portrait', label: 'Vertical' },
  { value: 'landscape', label: 'Horizontal' },
  { value: 'square', label: 'Cuadrada' },
  { value: 'panorama', label: 'Panorama' },
]

export default function GalleryPage() {
  const router = useRouter()
  const modal = useAppModal()
  const feedback = useMotionFeedback()
  const railRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const objectUrlsRef = useRef(new Set<string>())
  const scrollFrameRef = useRef<number | null>(null)

  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [orientation, setOrientation] = useState<OrientationFilter>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [peekOpen, setPeekOpen] = useState(true)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [tiltState, setTiltState] = useState<TiltState>('dismissed')
  const [showTiltConsent, setShowTiltConsent] = useState(false)
  const [deviceTilt, setDeviceTilt] = useState({ x: 0, y: 0 })
  const [viewport, setViewport] = useState({ width: 1440, height: 900 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [images, collections] = await Promise.all([listAllPromptImages(), listCollections()])
      const collectionById = new Map(collections.map((collection) => [collection.localId, collection.name]))

      const rows = await Promise.all(images.map(async (image) => {
        const [url, prompt] = await Promise.all([
          getBestImageUrl(image),
          getPromptByLocalId(image.promptLocalId),
        ])

        if (!url || prompt?.deletedAt) return null
        if (url.startsWith('blob:')) objectUrlsRef.current.add(url)

        const storageLabel = image.originalBlob
          ? 'Original local'
          : image.optimizedBlob
            ? 'Optimizada local'
            : 'Backup remoto'

        return {
          id: image.localId,
          promptLocalId: image.promptLocalId,
          promptTitle: prompt?.title ?? 'Prompt sin titulo',
          promptContent: prompt?.content ?? '',
          promptDescription: prompt?.description,
          promptType: prompt?.type ?? 'image_generation',
          model: prompt?.model,
          tags: prompt?.tags ?? [],
          collectionName: prompt?.collectionId ? collectionById.get(prompt.collectionId) : undefined,
          isFavorite: prompt?.isFavorite ?? false,
          syncStatus: prompt?.syncStatus ?? 'orphan',
          url,
          width: image.width,
          height: image.height,
          mimeType: image.mimeType,
          createdAt: image.createdAt,
          storageLabel,
        } satisfies GalleryItem
      }))

      const nextItems = rows.reduce<GalleryItem[]>((accumulator, row) => {
        if (row) accumulator.push(row)
        return accumulator
      }, [])
      setItems(nextItems)
      setActiveId((current) => current && nextItems.some((item) => item.id === current)
        ? current
        : nextItems[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current)
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [load])

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    const storedTilt = localStorage.getItem(TILT_STORAGE_KEY) as TiltState | null
    const storedConsent = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (storedTilt) setTiltState(storedTilt)
    if (!storedConsent && storedTilt !== 'enabled') setShowTiltConsent(true)
  }, [])

  useEffect(() => {
    if (tiltState !== 'enabled' || feedback.reducedMotion) {
      setDeviceTilt({ x: 0, y: 0 })
      return
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0
      const beta = event.beta ?? 0
      setDeviceTilt({
        x: clamp(gamma / 5, -5, 5),
        y: clamp((beta - 45) / -8, -5, 5),
      })
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [feedback.reducedMotion, tiltState])

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (favoritesOnly && !item.isFavorite) return false
      if (orientation !== 'all' && getOrientation(item) !== orientation) return false
      if (!needle) return true
      return [
        item.promptTitle,
        item.promptDescription ?? '',
        item.promptContent,
        item.model ?? '',
        item.collectionName ?? '',
        item.storageLabel,
        ...item.tags,
      ].some((value) => value.toLowerCase().includes(needle))
    })
  }, [favoritesOnly, items, orientation, query])

  const activeIndex = Math.max(0, filteredItems.findIndex((item) => item.id === activeId))
  const activeItem = filteredItems[activeIndex] ?? filteredItems[0]

  useEffect(() => {
    if (filteredItems.length === 0) {
      setActiveId(null)
      return
    }
    if (!activeId || !filteredItems.some((item) => item.id === activeId)) {
      setActiveId(filteredItems[0].id)
    }
  }, [activeId, filteredItems])

  const syncActiveFromScroll = useCallback(() => {
    const rail = railRef.current
    if (!rail || filteredItems.length === 0) return

    const maxScroll = rail.scrollWidth - rail.clientWidth
    setScrollProgress(maxScroll > 0 ? rail.scrollLeft / maxScroll : 0)

    const center = rail.scrollLeft + rail.clientWidth / 2
    let nearest = filteredItems[0]
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const item of filteredItems) {
      const element = itemRefs.current.get(item.id)
      if (!element) continue
      const itemCenter = element.offsetLeft + element.offsetWidth / 2
      const distance = Math.abs(center - itemCenter)
      if (distance < nearestDistance) {
        nearest = item
        nearestDistance = distance
      }
    }

    setActiveId(nearest.id)
  }, [filteredItems])

  const handleScroll = (_event: UIEvent<HTMLDivElement>) => {
    if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current)
    scrollFrameRef.current = requestAnimationFrame(syncActiveFromScroll)
  }

  const scrollToIndex = useCallback((index: number) => {
    const next = filteredItems[index]
    if (!next) return
    setActiveId(next.id)
    itemRefs.current.get(next.id)?.scrollIntoView({
      behavior: feedback.reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [feedback.reducedMotion, filteredItems])

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    event.currentTarget.scrollLeft += event.deltaY
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (filteredItems.length === 0) return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollToIndex(Math.min(activeIndex + 1, filteredItems.length - 1))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollToIndex(Math.max(activeIndex - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      scrollToIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      scrollToIndex(filteredItems.length - 1)
    } else if (event.key === 'Enter' && activeItem) {
      event.preventDefault()
      router.push(`/vault/${activeItem.promptLocalId}`)
    } else if (event.key === 'Escape') {
      setPeekOpen(false)
    }
  }

  const activateTilt = async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'seen')
    setShowTiltConsent(false)

    if (feedback.reducedMotion) {
      feedback.notify({ title: 'Movimiento reducido activo', message: 'La inclinacion queda desactivada.', tone: 'warning' })
      localStorage.setItem(TILT_STORAGE_KEY, 'dismissed')
      setTiltState('dismissed')
      return
    }

    if (!('DeviceOrientationEvent' in window)) {
      localStorage.setItem(TILT_STORAGE_KEY, 'unavailable')
      setTiltState('unavailable')
      feedback.notify({ title: 'Sensor no disponible', message: 'La galeria seguira usando gestos tactiles.' })
      return
    }

    const orientationApi = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission
    if (typeof orientationApi.requestPermission === 'function') {
      const permission = await orientationApi.requestPermission()
      if (permission !== 'granted') {
        localStorage.setItem(TILT_STORAGE_KEY, 'denied')
        setTiltState('denied')
        feedback.notify({ title: 'Permiso no concedido', message: 'Puedes seguir navegando la galeria normalmente.', tone: 'warning' })
        return
      }
    }

    localStorage.setItem(TILT_STORAGE_KEY, 'enabled')
    setTiltState('enabled')
    feedback.notify({ title: 'Inclinacion activa', message: 'Mueve suavemente el dispositivo frente a la obra.' })
  }

  const dismissTiltConsent = () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'seen')
    localStorage.setItem(TILT_STORAGE_KEY, 'dismissed')
    setTiltState('dismissed')
    setShowTiltConsent(false)
  }

  const disableTilt = () => {
    localStorage.setItem(TILT_STORAGE_KEY, 'dismissed')
    setTiltState('dismissed')
    setDeviceTilt({ x: 0, y: 0 })
  }

  const copyPrompt = async (item: GalleryItem) => {
    if (!item.promptContent.trim()) {
      feedback.notify({ title: 'Prompt no disponible', tone: 'warning' })
      return
    }
    await navigator.clipboard.writeText(item.promptContent)
    await recordCopy(item.promptLocalId)
    feedback.notify({ title: 'Prompt copiado', message: item.promptTitle })
  }

  const toggleFavoriteForItem = async (item: GalleryItem) => {
    const nextFavorite = !item.isFavorite
    setItems((current) => current.map((candidate) => (
      candidate.promptLocalId === item.promptLocalId
        ? { ...candidate, isFavorite: nextFavorite }
        : candidate
    )))
    try {
      await toggleFavorite(item.promptLocalId)
      feedback.notify({ title: nextFavorite ? 'Guardado como favorito' : 'Quitado de favoritos', durationMs: 1800 })
    } catch {
      setItems((current) => current.map((candidate) => (
        candidate.promptLocalId === item.promptLocalId
          ? { ...candidate, isFavorite: item.isFavorite }
          : candidate
      )))
      feedback.notify({ title: 'No se pudo actualizar', tone: 'warning' })
    }
  }

  const deleteImage = async (item: GalleryItem) => {
    const confirmed = await modal.confirm({
      title: 'Eliminar imagen',
      message: 'Se quitara esta imagen local de la galeria y del prompt asociado.',
      confirmLabel: 'Eliminar imagen',
      tone: 'danger',
    })
    if (!confirmed) return

    await deletePromptImage(item.id)
    if (item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url)
      objectUrlsRef.current.delete(item.url)
    }
    setItems((current) => current.filter((candidate) => candidate.id !== item.id))
    setActiveId((current) => current === item.id ? null : current)
    feedback.notify({ title: 'Imagen eliminada', tone: 'success' })
  }

  const handleImageDimensions = async (item: GalleryItem, width: number, height: number) => {
    if (item.width === width && item.height === height) return
    setItems((current) => current.map((candidate) => (
      candidate.id === item.id ? { ...candidate, width, height } : candidate
    )))
    if (!item.width || !item.height) {
      await updatePromptImageDimensions(item.id, { width, height }).catch(() => {})
    }
  }

  return (
    <div className="min-h-dvh overflow-hidden">
      <Header />
      <main className="motion-page flex min-h-[calc(100dvh-57px)] flex-col px-16 py-24">
        {modal.modalNode}

        <section className="mx-auto flex w-full max-w-[var(--page-max-width)] flex-1 flex-col">
          <div className="mb-16 flex flex-col gap-16 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-widest text-dim-gray">Vault local</p>
              <h1 className="mt-3 text-[24px] font-bold uppercase tracking-widest text-ghost-white md:text-[32px]">
                Galeria
              </h1>
              <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-dim-gray">
                Recorre tus imagenes como una pared horizontal. Cada obra conserva su proporcion original.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-8">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => scrollToIndex(activeIndex - 1)}
                disabled={filteredItems.length === 0 || activeIndex <= 0}
                aria-label="Imagen anterior"
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => scrollToIndex(activeIndex + 1)}
                disabled={filteredItems.length === 0 || activeIndex >= filteredItems.length - 1}
                aria-label="Imagen siguiente"
              >
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant={peekOpen ? 'filled' : 'ghost'}
                size="sm"
                onClick={() => setPeekOpen((value) => !value)}
                aria-pressed={peekOpen}
              >
                <Eye size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Prompt peek</span>
              </Button>
              <Button
                type="button"
                variant={tiltState === 'enabled' ? 'filled' : 'ghost'}
                size="sm"
                onClick={tiltState === 'enabled' ? disableTilt : activateTilt}
                aria-pressed={tiltState === 'enabled'}
              >
                <Smartphone size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{tiltState === 'enabled' ? 'Tilt on' : 'Tilt'}</span>
              </Button>
            </div>
          </div>

          <div className="mb-16 grid gap-12 xl:grid-cols-[minmax(260px,420px)_1fr] xl:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-16 top-1/2 z-10 -translate-y-1/2 text-dim-gray" size={16} aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar titulo, modelo, tag, coleccion..."
                aria-label="Buscar en galeria"
                className="pl-40"
              />
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-8">
              <span className="inline-flex items-center gap-6 text-[11px] uppercase tracking-widest text-dim-gray">
                <SlidersHorizontal size={14} aria-hidden="true" />
                Filtros
              </span>
              {orientationFilters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  variant={orientation === filter.value ? 'filled' : 'ghost'}
                  size="sm"
                  onClick={() => setOrientation(filter.value)}
                  aria-pressed={orientation === filter.value}
                >
                  {filter.label}
                </Button>
              ))}
              <Button
                type="button"
                variant={favoritesOnly ? 'filled' : 'ghost'}
                size="sm"
                onClick={() => setFavoritesOnly((value) => !value)}
                aria-pressed={favoritesOnly}
              >
                <Star size={15} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
                Favoritos
              </Button>
            </div>
          </div>

          {showTiltConsent && (
            <div className="motion-panel mb-16 flex flex-col gap-12 rounded-(--radius-card) border border-muted-ash bg-steel-gray p-12 text-[12px] text-dim-gray sm:flex-row sm:items-center sm:justify-between">
              <p>
                Activa inclinacion para que la obra responda al movimiento del dispositivo. Es opcional y se guarda solo como preferencia local.
              </p>
              <div className="flex shrink-0 gap-8">
                <Button type="button" variant="primary" size="sm" onClick={activateTilt}>
                  Activar inclinacion
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={dismissTiltConsent}>
                  Ahora no
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <GallerySkeleton />
          ) : filteredItems.length === 0 ? (
            <EmptyGallery hasQuery={!!query || favoritesOnly || orientation !== 'all'} />
          ) : (
            <>
              <div
                ref={railRef}
                tabIndex={0}
                role="region"
                aria-label="Galeria horizontal de imagenes locales"
                onScroll={handleScroll}
                onWheel={handleWheel}
                onKeyDown={handleKeyDown}
                className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth rounded-(--radius-card) border border-muted-ash bg-midnight-oil/70 focus-visible:ring-1 focus-visible:ring-ghost-white"
              >
                <div className="flex min-h-full items-center gap-16 px-[max(16px,calc((100vw-var(--page-max-width))/2+16px))] py-16 md:gap-24 md:py-24">
                  {filteredItems.map((item, index) => (
                    <GalleryArtwork
                      key={item.id}
                      refCallback={(element) => {
                        if (element) itemRefs.current.set(item.id, element)
                        else itemRefs.current.delete(item.id)
                      }}
                      item={item}
                      index={index}
                      active={item.id === activeItem?.id}
                      reducedMotion={feedback.reducedMotion}
                      deviceTilt={deviceTilt}
                      deviceTiltEnabled={tiltState === 'enabled'}
                      viewport={viewport}
                      onActivate={() => {
                        setActiveId(item.id)
                        setPeekOpen(true)
                        itemRefs.current.get(item.id)?.scrollIntoView({
                          behavior: feedback.reducedMotion ? 'auto' : 'smooth',
                          block: 'nearest',
                          inline: 'center',
                        })
                      }}
                      onCopy={() => copyPrompt(item)}
                      onFavorite={() => toggleFavoriteForItem(item)}
                      onDelete={() => deleteImage(item)}
                      onDimensions={(width, height) => handleImageDimensions(item, width, height)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-12 flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
                <div className="h-2 w-full overflow-hidden rounded-full bg-steel-gray md:max-w-md" aria-hidden="true">
                  <div
                    className="h-full bg-ghost-white transition-[width] duration-150"
                    style={{ width: `${Math.round(scrollProgress * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] uppercase tracking-widest text-dim-gray">
                  <span className="tabular-nums">{activeIndex + 1}</span> / <span className="tabular-nums">{filteredItems.length}</span>
                  {' '}imagenes
                </p>
              </div>

              {activeItem && (
                <ActivePromptPanel
                  item={activeItem}
                  open={peekOpen}
                  onToggleOpen={() => setPeekOpen((value) => !value)}
                  onCopy={() => copyPrompt(activeItem)}
                  onFavorite={() => toggleFavoriteForItem(activeItem)}
                  onDelete={() => deleteImage(activeItem)}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

function GalleryArtwork({
  refCallback,
  item,
  index,
  active,
  reducedMotion,
  deviceTilt,
  deviceTiltEnabled,
  viewport,
  onActivate,
  onCopy,
  onFavorite,
  onDelete,
  onDimensions,
}: {
  refCallback: (element: HTMLElement | null) => void
  item: GalleryItem
  index: number
  active: boolean
  reducedMotion: boolean
  deviceTilt: { x: number; y: number }
  deviceTiltEnabled: boolean
  viewport: { width: number; height: number }
  onActivate: () => void
  onCopy: () => void
  onFavorite: () => void
  onDelete: () => void
  onDimensions: (width: number, height: number) => void
}) {
  const ratio = getImageRatio(item)
  const orientation = getOrientation(item)
  const artworkHeight = Math.round(Math.min(viewport.height * 0.58, 620))
  const artworkWidth = Math.round(clamp(
    artworkHeight * ratio,
    Math.min(viewport.width * 0.68, 230),
    Math.min(viewport.width * 0.82, 920),
  ))
  const transform = reducedMotion
    ? 'none'
    : active && deviceTiltEnabled
      ? `perspective(900px) rotateX(${deviceTilt.y}deg) rotateY(${deviceTilt.x}deg) scale(1.015)`
      : `perspective(900px) rotateX(0deg) rotateY(0deg) scale(${active ? 1.015 : 0.985})`

  return (
    <article
      ref={refCallback}
      data-gallery-artwork
      aria-current={active || undefined}
      className={[
        'motion-panel group flex shrink-0 snap-center flex-col gap-8 outline-none',
        active ? 'opacity-100' : 'opacity-60 hover:opacity-90',
      ].join(' ')}
      style={{
        width: artworkWidth,
        '--motion-index': index,
      } as CSSProperties}
      onPointerMove={(event) => {
        if (reducedMotion || event.pointerType !== 'mouse') return
        const frame = event.currentTarget.querySelector<HTMLElement>('[data-art-frame]')
        if (!frame) return
        const rect = event.currentTarget.getBoundingClientRect()
        const x = (event.clientX - rect.left) / rect.width - 0.5
        const y = (event.clientY - rect.top) / rect.height - 0.5
        frame.style.transform = `perspective(900px) rotateX(${-y * 6}deg) rotateY(${x * 7}deg) scale(${active ? 1.02 : 1})`
      }}
      onPointerLeave={(event) => {
        const frame = event.currentTarget.querySelector<HTMLElement>('[data-art-frame]')
        if (frame) frame.style.transform = transform
      }}
    >
      <button
        type="button"
        onClick={onActivate}
        onFocus={onActivate}
        className="block cursor-pointer text-left focus-visible:outline-none"
        aria-label={`Ver imagen de ${item.promptTitle}`}
      >
        <div
          data-art-frame
          className={[
            'relative flex items-center justify-center overflow-hidden rounded-(--radius-card) border bg-midnight-oil transition-[transform,border-color,opacity] duration-300 ease-out',
            active ? 'border-ghost-white' : 'border-muted-ash group-hover:border-dim-gray',
          ].join(' ')}
          style={{
            height: artworkHeight,
            transform,
            transformStyle: 'preserve-3d',
          }}
        >
          <img
            src={item.url}
            alt={item.promptTitle}
            width={item.width}
            height={item.height}
            className="block max-h-full max-w-full select-none object-contain"
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding={index < 2 ? 'sync' : 'async'}
            draggable={false}
            onLoad={(event) => {
              const img = event.currentTarget
              if (img.naturalWidth && img.naturalHeight) {
                onDimensions(img.naturalWidth, img.naturalHeight)
              }
            }}
          />

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.7)_100%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

          <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between gap-8 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold uppercase tracking-widest text-ghost-white">
                {item.promptTitle}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-dim-gray">
                {formatDimensions(item)} / {orientation}
              </p>
            </div>
          </div>
        </div>
      </button>

      <div className="flex min-w-0 items-center justify-between gap-8">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-ghost-white">{item.promptTitle}</p>
          <p className="truncate text-[11px] text-dim-gray">{item.storageLabel}</p>
        </div>
        <div className="flex shrink-0 gap-6">
          <IconAction label="Copiar prompt" onClick={onCopy}>
            <Copy size={16} aria-hidden="true" />
          </IconAction>
          <IconAction
            label={item.isFavorite ? 'Quitar de favoritos' : 'Anadir a favoritos'}
            onClick={onFavorite}
            pressed={item.isFavorite}
          >
            <Star size={16} fill={item.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </IconAction>
          <Link
            href={`/vault/${item.promptLocalId}`}
            aria-label={`Abrir prompt ${item.promptTitle}`}
            className="motion-press grid h-11 w-11 place-items-center rounded-(--radius-button) border border-muted-ash text-ghost-white hover:border-ghost-white"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </Link>
          <IconAction label="Eliminar imagen" onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" />
          </IconAction>
        </div>
      </div>
    </article>
  )
}

function ActivePromptPanel({
  item,
  open,
  onToggleOpen,
  onCopy,
  onFavorite,
  onDelete,
}: {
  item: GalleryItem
  open: boolean
  onToggleOpen: () => void
  onCopy: () => void
  onFavorite: () => void
  onDelete: () => void
}) {
  const summary = (item.promptDescription || item.promptContent || '').replace(/\s+/g, ' ').trim()

  return (
    <aside className="motion-panel mt-16 rounded-(--radius-card) border border-muted-ash bg-steel-gray">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between gap-16 px-16 py-12 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-dim-gray">Prompt peek</p>
          <h2 className="truncate text-[15px] font-bold uppercase tracking-widest text-ghost-white">
            {item.promptTitle}
          </h2>
        </div>
        <span className="text-[18px] text-dim-gray" aria-hidden="true">{open ? '-' : '+'}</span>
      </button>

      <div className={[
        'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      ].join(' ')}>
        <div className="min-h-0 overflow-hidden border-t border-muted-ash">
          <div className="grid gap-16 p-16 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="min-w-0 space-y-12">
              <div className="flex flex-wrap items-center gap-8">
                <Pill>{getPromptTypeLabel(item.promptType)}</Pill>
                <ModelPill model={item.model} size="xs" />
                <Pill>{item.storageLabel}</Pill>
                <Pill>{formatDimensions(item)}</Pill>
                {item.collectionName && <Pill>{item.collectionName}</Pill>}
                {item.tags.slice(0, 5).map((tag) => <Pill key={tag}>{tag}</Pill>)}
              </div>

              <p className="line-clamp-3 max-w-5xl text-[12px] leading-relaxed text-dim-gray">
                {summary || 'Sin descripcion disponible.'}
              </p>

              {item.promptContent && (
                <pre className="max-h-32 overflow-auto rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12 text-[11px] leading-relaxed text-dim-gray">
                  {item.promptContent}
                </pre>
              )}
            </div>

            <div className="flex flex-wrap gap-8 lg:justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
                <Copy size={16} aria-hidden="true" />
                Copiar
              </Button>
              <Button
                type="button"
                variant={item.isFavorite ? 'filled' : 'ghost'}
                size="sm"
                onClick={onFavorite}
                aria-pressed={item.isFavorite}
              >
                <Star size={16} fill={item.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                Favorito
              </Button>
              <Link href={`/vault/${item.promptLocalId}`}>
                <Button type="button" variant="primary" size="sm">
                  <ExternalLink size={16} aria-hidden="true" />
                  Abrir
                </Button>
              </Link>
              <Button type="button" variant="danger" size="sm" onClick={onDelete}>
                <Trash2 size={16} aria-hidden="true" />
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function IconAction({
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
        event.stopPropagation()
        onClick()
      }}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className="motion-press grid h-11 w-11 place-items-center rounded-(--radius-button) border border-muted-ash text-ghost-white hover:border-ghost-white"
    >
      {children}
    </button>
  )
}

function GallerySkeleton() {
  return (
    <div className="flex flex-1 items-center gap-16 overflow-hidden rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16">
      <div className="grid min-w-28 place-items-center">
        <MascotAnimation variant="loading" size="lg" crop="tight" />
      </div>
      {[0.68, 1.2, 0.82, 1.55].map((ratio, index) => (
        <div
          key={`${ratio}-${index}`}
          className="motion-skeleton h-[min(58dvh,620px)] shrink-0 rounded-(--radius-card)"
          style={{
            width: `min(82vw, ${index % 2 === 0 ? 340 : 520}px)`,
            minWidth: '220px',
            '--motion-index': index,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

function EmptyGallery({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Card className="motion-panel flex flex-1 flex-col items-center justify-center gap-16 py-32 text-center">
      <MascotAnimation variant="greeting" size="lg" crop="tight" />
      <div className="grid h-16 w-16 place-items-center rounded-(--radius-button) border border-muted-ash text-dim-gray">
        {hasQuery ? <RotateCcw size={28} aria-hidden="true" /> : <ImageIcon size={28} aria-hidden="true" />}
      </div>
      <div className="max-w-md">
        <h2 className="text-[16px] font-bold uppercase tracking-widest text-ghost-white">
          {hasQuery ? 'Sin resultados' : 'Sin imagenes locales'}
        </h2>
        <p className="mt-6 text-[13px] leading-relaxed text-dim-gray">
          {hasQuery
            ? 'Ajusta la busqueda o filtros para volver al recorrido completo.'
            : 'Agrega imagenes a tus prompts del Vault y apareceran aqui como una galeria horizontal.'}
        </p>
      </div>
      <Link href="/vault/new">
        <Button variant="ghost" size="sm">Crear prompt con imagen</Button>
      </Link>
    </Card>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-(--radius-button) border border-muted-ash px-8 py-5 text-[10px] font-bold uppercase leading-none text-ghost-white">
      {children}
    </span>
  )
}

function getImageRatio(item: GalleryItem) {
  if (!item.width || !item.height) return 1
  return clamp(item.width / item.height, 0.42, 2.4)
}

function getOrientation(item: Pick<GalleryItem, 'width' | 'height'>): OrientationFilter {
  if (!item.width || !item.height) return 'square'
  const ratio = item.width / item.height
  if (ratio > 1.9) return 'panorama'
  if (ratio > 1.08) return 'landscape'
  if (ratio < 0.92) return 'portrait'
  return 'square'
}

function formatDimensions(item: Pick<GalleryItem, 'width' | 'height'>) {
  if (!item.width || !item.height) return 'dimensiones pendientes'
  return `${item.width}x${item.height}`
}

function getPromptTypeLabel(type: LocalPrompt['type']) {
  const labels: Record<LocalPrompt['type'], string> = {
    image_generation: 'Generacion',
    image_editing: 'Edicion',
    other: 'Otro',
  }
  return labels[type]
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
