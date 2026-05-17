'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BrainCircuit,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileClock,
  GitBranch,
  Languages,
  Maximize2,
  Pencil,
  RotateCcw,
  Save,
  Send,
  Share2,
  Sparkles,
  Star,
  Target,
  Trash2,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AppModal, useAppModal } from '@/components/ui/Modal'
import { useMotionFeedback } from '@/components/ui/MotionProvider'
import { ImageUploader } from '@/components/images/ImageUploader'
import { ModelPill } from '@/components/models/ModelPill'
import { ModelTargetSelector } from '@/components/models/ModelTargetSelector'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'
import { authClient } from '@/lib/authClient'
import { useNetwork } from '@/lib/hooks/useNetwork'
import { normalizeModelValue } from '@/lib/models/modelTargets'
import {
  createPrompt,
  getPromptByLocalId,
  updatePrompt,
  recordCopy,
  toggleFavorite,
  saveVersion,
  getVersions,
  softDeletePrompt,
} from '@/lib/db/repositories/promptRepository'
import { addPromptImage, deletePromptImage, listPromptImages, getBestImageUrl } from '@/lib/db/repositories/imageRepository'
import { getCachedPromptTranslation, saveCachedPromptTranslation } from '@/lib/db/repositories/translationCacheRepository'
import type { LocalPrompt, LocalPromptImage, LocalPromptVersion, ContentType, PromptType } from '@/lib/db/schema'

const CONTENT_TYPES: ContentType[] = ['text', 'markdown', 'json']
const PROMPT_TYPES: PromptType[] = ['image_generation', 'image_editing', 'other']

const AI_MESSAGES: Record<string, string[]> = {
  '/api/ai/magic': [
    'Leyendo estructura del prompt...',
    'Interpretando tu pedido de edición...',
    'Ajustando solo las partes necesarias...',
    'Conservando estructura, intención y estilo...',
  ],
  '/api/ai/variations': [
    'Separando intencion principal...',
    'Explorando rutas alternativas...',
    'Equilibrando diferencias entre variantes...',
    'Preparando comparacion legible...',
  ],
  '/api/ai/adapt': [
    'Analizando compatibilidad del modelo...',
    'Traduciendo sintaxis y restricciones...',
    'Ajustando instrucciones clave...',
    'Validando que el resultado sea usable...',
  ],
  '/api/ai/score': [
    'Evaluando claridad del objetivo...',
    'Revisando ambiguedades visuales...',
    'Ponderando calidad y control...',
    'Redactando rationale breve...',
  ],
  '/api/ai/translate': [
    'Detectando idioma y estructura...',
    'Traduciendo sin alterar parametros...',
    'Preservando pesos, negativos y placeholders...',
    'Preparando lectura en espanol...',
  ],
}

type AiWork = {
  title: string
  messages: string[]
}

type MagicEditMode = 'request' | 'loading' | 'result' | 'iterateRequest'

type AiErrorBody = {
  error?: string
  code?: string
  resetAt?: string
}

type TranslationResult = {
  translatedContent: string
  detectedSourceLanguage?: string
  notes?: string
  warnings?: string[]
}

type PromptImageItem = {
  image: LocalPromptImage
  url: string
}

export default function PromptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const { online } = useNetwork()
  const modal = useAppModal()
  const feedback = useMotionFeedback()

  const [prompt, setPrompt] = useState<LocalPrompt | null>(null)
  const [editing, setEditing] = useState(false)
  const [versions, setVersions] = useState<LocalPromptVersion[]>([])
  const [showVersions, setShowVersions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [zenMode, setZenMode] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [imageItems, setImageItems] = useState<PromptImageItem[]>([])
  const [selectedImage, setSelectedImage] = useState(0)
  const [aiBusy, setAiBusy] = useState<string | null>(null)
  const [aiWork, setAiWork] = useState<AiWork | null>(null)
  const [compareValue, setCompareValue] = useState(50)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [magicOpen, setMagicOpen] = useState(false)
  const [magicMode, setMagicMode] = useState<MagicEditMode>('request')
  const [magicInstruction, setMagicInstruction] = useState('')
  const [magicIterationInstruction, setMagicIterationInstruction] = useState('')
  const [magicSourceContent, setMagicSourceContent] = useState('')
  const [magicLastSourceContent, setMagicLastSourceContent] = useState('')
  const [magicResult, setMagicResult] = useState('')
  const [magicError, setMagicError] = useState('')
  const [magicCopied, setMagicCopied] = useState(false)
  const [magicWorkTitle, setMagicWorkTitle] = useState('Editando con IA')
  const [translationOpen, setTranslationOpen] = useState(false)
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null)
  const [translationCopied, setTranslationCopied] = useState(false)
  const [translationSaving, setTranslationSaving] = useState(false)
  const [zenContent, setZenContent] = useState<{ title: string; content: string; returnToTranslation?: boolean } | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentType, setContentType] = useState<ContentType>('text')
  const [description, setDescription] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [type, setType] = useState<PromptType>('image_generation')
  const [model, setModel] = useState('')

  useEffect(() => {
    if (!id) return
    void loadPrompt()
  }, [id])

  useEffect(() => {
    if (selectedImage > imageItems.length - 1) setSelectedImage(Math.max(0, imageItems.length - 1))
  }, [imageItems.length, selectedImage])

  useEffect(() => {
    if (!openMenu) return
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('[data-action-menu-root]')) setOpenMenu(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openMenu])

  async function loadPrompt() {
    const item = await getPromptByLocalId(id)
    if (!item) {
      router.replace('/vault')
      return
    }
    setPrompt(item)
    resetForm(item)
    const images = await listPromptImages(item.localId)
    const items = (await Promise.all(images.map(async (image) => ({
      image,
      url: await getBestImageUrl(image),
    })))).filter((imageItem): imageItem is PromptImageItem => Boolean(imageItem.url))
    setImageItems((prev) => {
      prev.forEach(({ url }) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
      return items
    })
  }

  function resetForm(item: LocalPrompt) {
    setTitle(item.title)
    setContent(item.content)
    setContentType(item.contentType)
    setDescription(item.description ?? '')
    setTagsRaw(item.tags.join(', '))
    setType(item.type)
    setModel(item.model ?? '')
  }

  async function handleCopy() {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt.content)
    await recordCopy(prompt.localId)
    setCopied(true)
    feedback.notify({ title: 'Prompt copiado', message: prompt.title || 'Contenido listo en el portapapeles.' })
    setTimeout(() => setCopied(false), 2000)
    await loadPrompt()
  }

  async function handleToggleFav() {
    if (!prompt) return
    await toggleFavorite(prompt.localId)
    feedback.notify({ title: prompt.isFavorite ? 'Quitado de favoritos' : 'Marcado como favorito', durationMs: 1800 })
    await loadPrompt()
  }

  async function handleSave() {
    if (!prompt) return
    if (!model.trim()) {
      feedback.notify({
        title: 'Modelo requerido',
        message: 'Selecciona Gemini, ChatGPT u Otro modelo.',
        tone: 'warning',
      })
      return
    }
    setSaving(true)
    try {
      await saveVersion(prompt.localId)
      const tags = tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean)
      await updatePrompt(prompt.localId, {
        title: title.trim(),
        content,
        contentType,
        description: description.trim() || undefined,
        tags,
        type,
        model: normalizeModelValue(model),
      })
      setEditing(false)
      feedback.notify({ title: 'Prompt guardado', message: 'Se creo una version previa automaticamente.', tone: 'success' })
      await loadPrompt()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!prompt || editing) return
    const confirmed = await modal.confirm({
      title: 'Eliminar prompt',
      message: 'Esta accion quitara el prompt del vault local.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!confirmed) return
    await softDeletePrompt(prompt.localId)
    feedback.notify({ title: 'Prompt eliminado', tone: 'warning' })
    router.replace('/vault')
  }

  async function handleShowVersions() {
    if (!prompt) return
    const snapshots = await getVersions(prompt.localId)
    setVersions(snapshots)
    setShowVersions(true)
    feedback.notify({
      title: 'Versiones cargadas',
      message: `${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'} disponible${snapshots.length === 1 ? '' : 's'}.`,
    })
  }

  async function handlePublish() {
    if (!prompt) return
    if (!prompt.model?.trim()) {
      feedback.notify({
        title: 'Modelo requerido',
        message: 'Edita el prompt y selecciona Gemini, ChatGPT u Otro modelo antes de publicar.',
        tone: 'warning',
      })
      return
    }
    const optimizedImageUrl = await getSelectedCoverDataUrl()
    const confirmed = await modal.confirm({
      title: 'Publicar snapshot',
      message: 'Se enviara una copia a Prompterest. Solo tu NickName sera visible.',
      confirmLabel: 'Publicar',
      size: 'md',
    })
    if (!confirmed) return
    setPublishing(true)
    try {
      const res = await fetch('/api/public/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId: prompt.localId,
          title: prompt.title,
          description: prompt.description ?? '',
          content: prompt.content,
          contentType: prompt.contentType,
          type: prompt.type,
          model: normalizeModelValue(prompt.model),
          tags: prompt.tags,
          optimizedImageUrl,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        await modal.alert({
          title: 'No se pudo publicar',
          message: body.error ?? 'La publicacion fallo. Revisa la sesion o intenta de nuevo.',
        })
        return
      }
      setPublished(true)
      feedback.notify({ title: 'Publicado en Prompterest', message: 'El snapshot ya es visible para la comunidad.', tone: 'success' })
    } finally {
      setPublishing(false)
    }
  }

  async function getSelectedCoverDataUrl() {
    if (!prompt) return undefined
    const images = await listPromptImages(prompt.localId)
    const image = images[selectedImage] ?? images[0]
    if (!image) return undefined
    if (image.remoteUrl?.startsWith('data:image/')) return image.remoteUrl

    const blob = image.optimizedBlob ?? image.originalBlob
    if (!blob) return undefined
    return new Promise<string | undefined>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : undefined
        resolve(result?.startsWith('data:image/') ? result : undefined)
      }
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(blob)
    })
  }

  async function handleAddImages(files: File[]) {
    if (!prompt) return
    for (const file of files) {
      await addPromptImage(prompt.localId, file)
    }
    feedback.notify({
      title: 'Imagenes agregadas',
      message: `${files.length} referencia${files.length === 1 ? '' : 's'} adjunta${files.length === 1 ? '' : 's'}.`,
    })
    await loadPrompt()
  }

  async function handleDeleteImage(imageLocalId: string) {
    if (!editing) return
    const confirmed = await modal.confirm({
      title: 'Quitar imagen',
      message: 'Se quitara la imagen original local y su copia optimizada para backup/sincronizacion.',
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (!confirmed) return
    await deletePromptImage(imageLocalId)
    feedback.notify({ title: 'Imagen quitada', message: 'La referencia completa fue eliminada.', tone: 'warning' })
    await loadPrompt()
  }

  function handleExportPng() {
    if (!prompt) return
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#383838'
    ctx.lineWidth = 2
    ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64)

    ctx.fillStyle = '#ffffff'
    ctx.font = '700 34px ui-monospace, monospace'
    ctx.fillText(prompt.title || 'Promptier prompt', 64, 92)

    ctx.fillStyle = '#888888'
    ctx.font = '20px ui-monospace, monospace'
    ctx.fillText(`/${prompt.contentType} /${prompt.type}`, 64, 128)

    ctx.fillStyle = '#ffffff'
    ctx.font = '22px ui-monospace, monospace'
    const words = prompt.content.replace(/\s+/g, ' ').split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const next = `${line} ${word}`.trim()
      if (ctx.measureText(next).width > 1060) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
      if (lines.length >= 15) break
    }
    if (line && lines.length < 15) lines.push(line)
    lines.forEach((text, index) => ctx.fillText(text, 64, 190 + index * 30))

    ctx.fillStyle = '#888888'
    ctx.font = '18px ui-monospace, monospace'
    ctx.fillText('PROMPTIER', 64, 584)

    const link = document.createElement('a')
    link.download = `${prompt.title || 'promptier-prompt'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    feedback.notify({ title: 'PNG exportado', message: 'La imagen se genero desde el prompt actual.' })
  }

  async function callAi(path: string, body: Record<string, unknown>, workTitle: string) {
    if (!online) {
      await modal.alert({
        title: 'AI no disponible',
        message: 'Necesitas conexion para usar las acciones de AI.',
      })
      return null
    }
    setAiBusy(path)
    setAiWork({ title: workTitle, messages: AI_MESSAGES[path] ?? ['Preparando solicitud...', 'Esperando respuesta...'] })
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({})) as AiErrorBody
      if (!res.ok) {
        const sharedLimit = data.code === 'SHARED_AI_DAILY_LIMIT' || data.code === 'SHARED_AI_RATE_LIMIT'
        await modal.alert({
          title: sharedLimit ? 'Limite de AI compartida' : 'Accion de AI fallida',
          message: data.error ?? 'La accion de AI fallo.',
          content: sharedLimit ? (
            <Button type="button" variant="primary" size="sm" onClick={() => router.push('/user')}>
              Configurar API key propia
            </Button>
          ) : null,
        })
        return null
      }
      return data
    } finally {
      setAiBusy(null)
      setAiWork(null)
    }
  }

  function handleMagicTouch() {
    if (!prompt) return
    setOpenMenu(null)
    setMagicSourceContent(prompt.content)
    setMagicLastSourceContent(prompt.content)
    setMagicInstruction('')
    setMagicIterationInstruction('')
    setMagicResult('')
    setMagicError('')
    setMagicCopied(false)
    setMagicWorkTitle('Preparando Edición Mágica')
    setMagicMode('request')
    setMagicOpen(true)
  }

  async function requestMagicEdit(sourceContent: string, mode: 'edit' | 'retry' | 'iterate', requestOverride?: string) {
    const editRequest = (requestOverride ?? magicInstruction).trim()
    const fallbackMode: MagicEditMode = mode === 'iterate' ? 'iterateRequest' : 'request'
    if (!prompt || !sourceContent.trim()) return
    if (editRequest.length < 4) {
      setMagicError('Cuéntame qué quieres cambiar o en qué debe enfocarse la mejora.')
      setMagicMode(fallbackMode)
      return
    }
    if (!online) {
      await modal.alert({
        title: 'AI no disponible',
        message: 'Necesitas conexion para usar las acciones de AI.',
      })
      return
    }

    setMagicCopied(false)
    setMagicError('')
    setMagicMode('loading')
    setMagicWorkTitle(mode === 'retry' ? 'Buscando otra edición' : mode === 'iterate' ? 'Puliendo esta versión' : 'Editando con IA')
    setMagicLastSourceContent(sourceContent)
    setAiBusy('/api/ai/magic')
    try {
      const res = await fetch('/api/ai/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: sourceContent,
          editRequest,
          mode,
          previousResult: mode === 'retry' ? magicResult : undefined,
        }),
      })
      const data = await res.json().catch(() => ({})) as { improvedContent?: string } & AiErrorBody
      if (!res.ok || !data.improvedContent) {
        const sharedLimit = data.code === 'SHARED_AI_DAILY_LIMIT' || data.code === 'SHARED_AI_RATE_LIMIT'
        setMagicError(data.error ?? 'La edición de AI falló. Intenta ajustar el pedido.')
        if (sharedLimit) {
          feedback.notify({
            title: 'Limite de AI compartida',
            message: 'Abre Usuario para configurar tu API key propia.',
            tone: 'warning',
          })
        }
        setMagicMode(fallbackMode)
        return
      }
      if (mode === 'iterate') {
        setMagicInstruction(editRequest)
        setMagicIterationInstruction('')
      }
      setMagicResult(data.improvedContent)
      setMagicMode('result')
      feedback.notify({ title: 'Edición lista', message: 'Puedes iterar, cambiar el pedido o copiar el resultado.' })
    } catch {
      setMagicError('No se pudo completar la edición. Revisa la conexión e intenta de nuevo.')
      setMagicMode(fallbackMode)
    } finally {
      setAiBusy(null)
    }
  }

  async function handleCopyMagicResult() {
    if (!magicResult) return
    await navigator.clipboard.writeText(magicResult)
    setMagicCopied(true)
    feedback.notify({ title: 'Edición copiada', message: 'Resultado listo en el portapapeles.', tone: 'success' })
    window.setTimeout(() => setMagicCopied(false), 2000)
  }

  async function handleVariations() {
    if (!prompt) return
    const data = await callAi('/api/ai/variations', { content: prompt.content }, 'Generando variantes') as { variations?: string[] } | null
    if (data?.variations) {
      feedback.notify({ title: 'Variantes listas', message: 'Revisa las tres opciones en el modal.' })
      await modal.alert({
        title: '3 variantes',
        message: 'Tres alternativas listas para comparar o copiar manualmente.',
        size: 'lg',
        content: (
          <div className="grid gap-8">
            {data.variations.map((item, index) => (
              <article key={`${index}-${item}`} className="motion-panel rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16">
                <p className="mb-8 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
                  Variante {index + 1}
                </p>
                <p className="whitespace-pre-wrap font-terminal text-[13px] leading-relaxed text-ghost-white">
                  {item}
                </p>
              </article>
            ))}
          </div>
        ),
      })
    }
  }

  async function handleScore() {
    if (!prompt) return
    const data = await callAi('/api/ai/score', { content: prompt.content }, 'Calculando score') as { score?: number; rationale?: string } | null
    if (typeof data?.score === 'number') {
      await updatePrompt(prompt.localId, { qualityScore: data.score })
      feedback.notify({ title: `Score ${data.score}/100`, message: 'El puntaje quedo guardado.' })
      await modal.alert({
        title: `Score ${data.score}/100`,
        message: 'El puntaje quedo guardado en el prompt.',
        content: data.rationale ? <AiResultBlock asParagraph>{data.rationale}</AiResultBlock> : null,
      })
      await loadPrompt()
    }
  }

  async function handleAdapt() {
    if (!prompt) return
    const targetModel = await modal.prompt({
      title: 'Adaptar prompt',
      label: 'Modelo destino',
      placeholder: 'Midjourney, GPT Image, Flux...',
      confirmLabel: 'Adaptar',
      maxLength: 80,
      validate: (value) => value.length < 2 ? 'Indica un modelo destino.' : null,
    })
    if (!targetModel?.trim()) return
    const data = await callAi(
      '/api/ai/adapt',
      { content: prompt.content, targetModel },
      `Adaptando a ${targetModel.trim()}`,
    ) as { adaptedContent?: string } | null
    if (!data?.adaptedContent) return
    const confirmed = await modal.confirm({
      title: 'Aplicar adaptacion',
      message: 'Se guardara una version antes de reemplazar el contenido actual.',
      confirmLabel: 'Aplicar',
      size: 'lg',
      content: <AiResultBlock>{data.adaptedContent}</AiResultBlock>,
    })
    if (confirmed) {
      await saveVersion(prompt.localId)
      await updatePrompt(prompt.localId, { content: data.adaptedContent, model: normalizeModelValue(targetModel) })
      feedback.notify({ title: 'Adaptacion aplicada', message: targetModel.trim(), tone: 'success' })
      await loadPrompt()
    }
  }

  async function handleTranslatePrompt() {
    if (!prompt) return
    setOpenMenu(null)
    setTranslationCopied(false)

    const cachedTranslation = await getCachedPromptTranslation(prompt.localId, prompt.content)
    if (cachedTranslation) {
      setTranslationResult(cachedTranslation)
      setTranslationOpen(true)
      feedback.notify({ title: 'Traduccion local', message: 'Ya estaba guardada para esta version del prompt.' })
      return
    }

    const data = await callAi(
      '/api/ai/translate',
      { content: prompt.content },
      'Traduciendo prompt',
    ) as TranslationResult | null
    if (!data?.translatedContent) return
    await saveCachedPromptTranslation(prompt.localId, prompt.content, data)
    setTranslationResult(data)
    setTranslationOpen(true)
    feedback.notify({ title: 'Traduccion lista', message: 'Puedes copiarla, guardarla como rama o leerla en Zen.' })
  }

  async function handleCopyTranslation() {
    if (!translationResult?.translatedContent) return
    await navigator.clipboard.writeText(translationResult.translatedContent)
    setTranslationCopied(true)
    feedback.notify({ title: 'Traduccion copiada', tone: 'success' })
    window.setTimeout(() => setTranslationCopied(false), 1800)
  }

  async function handleSaveTranslationBranch() {
    if (!prompt || !translationResult?.translatedContent) return
    setTranslationSaving(true)
    try {
      const branch = await createPrompt({
        title: `${prompt.title || 'Prompt'} / ES`.slice(0, 120),
        content: translationResult.translatedContent,
        contentType: prompt.contentType,
        description: [
          'Rama traducida al espanol desde el prompt original.',
          prompt.description,
        ].filter(Boolean).join(' '),
        tags: Array.from(new Set([...prompt.tags, 'espanol'])),
        type: prompt.type,
        model: prompt.model,
        collectionId: prompt.collectionId,
      })
      feedback.notify({ title: 'Rama guardada', message: branch.title, tone: 'success' })
    } finally {
      setTranslationSaving(false)
    }
  }

  function handleReadTranslationZen() {
    if (!prompt || !translationResult?.translatedContent) return
    setZenContent({
      title: `${prompt.title || 'Prompt'} / ES`,
      content: translationResult.translatedContent,
      returnToTranslation: true,
    })
    setTranslationOpen(false)
    setZenMode(true)
  }

  async function handleRestoreVersion(version: LocalPromptVersion) {
    if (!prompt) return
    const confirmed = await modal.confirm({
      title: 'Restaurar version',
      message: 'El contenido actual se guardara como nueva version antes de restaurar esta copia.',
      confirmLabel: 'Restaurar',
      size: 'md',
    })
    if (!confirmed) return
    await saveVersion(prompt.localId)
    await updatePrompt(prompt.localId, {
      content: version.content,
      title: version.title,
    })
    setShowVersions(false)
    setEditing(false)
    feedback.notify({ title: 'Version restaurada', tone: 'success' })
    await loadPrompt()
  }

  const promptTypeLabel = useMemo(() => prompt?.type.replace('_', ' ') ?? '', [prompt?.type])

  if (!prompt) {
    return (
      <div className="motion-panel flex min-h-40 w-full max-w-4xl items-center gap-12 rounded-(--radius-card) border border-muted-ash bg-steel-gray p-16" aria-label="Cargando prompt">
        <MascotAnimation variant="loading" size="md" crop="tight" />
        <p className="font-terminal text-[13px] text-dim-gray">Cargando prompt...</p>
      </div>
    )
  }

  if (zenMode) {
    const zenPayload = zenContent ?? { title: prompt.title || 'Prompt', content: prompt.content }
    const exitZen = () => {
      const shouldReturnToTranslation = !!zenContent?.returnToTranslation
      setZenMode(false)
      setZenContent(null)
      if (shouldReturnToTranslation) setTranslationOpen(true)
    }
    return (
      <div className="motion-page fixed inset-0 z-50 flex flex-col items-center justify-center bg-midnight-oil p-32">
        <div className="mb-16 w-full max-w-3xl">
          <p className="text-[11px] uppercase tracking-widest text-dim-gray">Modo zen</p>
          <h1 className="mt-3 truncate text-[18px] font-bold uppercase tracking-widest text-ghost-white">
            {zenPayload.title}
          </h1>
        </div>
        <pre className="max-h-[72dvh] w-full max-w-3xl overflow-auto whitespace-pre-wrap rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16 font-terminal text-[14px] leading-relaxed text-ghost-white">
          {zenPayload.content}
        </pre>
        <Button variant="ghost" size="sm" className="mt-32" onClick={exitZen}>
          Salir del modo zen
        </Button>
      </div>
    )
  }

  return (
    <section className="motion-page w-full max-w-(--page-max-width)">
      {modal.modalNode}
      <MagicEditModal
        open={magicOpen}
        mode={magicMode}
        instruction={magicInstruction}
        iterationInstruction={magicIterationInstruction}
        result={magicResult}
        error={magicError}
        copied={magicCopied}
        workTitle={magicWorkTitle}
        onOpenChange={setMagicOpen}
        onInstructionChange={(value) => {
          setMagicInstruction(value)
          if (magicError) setMagicError('')
        }}
        onIterationInstructionChange={(value) => {
          setMagicIterationInstruction(value)
          if (magicError) setMagicError('')
        }}
        onSubmit={() => void requestMagicEdit(magicSourceContent || prompt.content, 'edit')}
        onRetry={() => void requestMagicEdit(magicLastSourceContent || magicSourceContent || prompt.content, 'retry')}
        onIterate={() => {
          setMagicIterationInstruction('')
          setMagicCopied(false)
          setMagicError('')
          setMagicMode('iterateRequest')
        }}
        onSubmitIteration={() => void requestMagicEdit(magicResult, 'iterate', magicIterationInstruction)}
        onBackToResult={() => {
          setMagicError('')
          setMagicMode('result')
        }}
        onChangeRequest={() => {
          setMagicResult('')
          setMagicCopied(false)
          setMagicIterationInstruction('')
          setMagicMode('request')
        }}
        onCopy={() => void handleCopyMagicResult()}
      />
      <TranslationModal
        open={translationOpen}
        result={translationResult}
        copied={translationCopied}
        saving={translationSaving}
        onOpenChange={setTranslationOpen}
        onCopy={() => void handleCopyTranslation()}
        onSaveBranch={() => void handleSaveTranslationBranch()}
        onReadZen={handleReadTranslationZen}
      />
      <AiWorkOverlay work={aiWork} />

      <header className="mb-3 flex flex-col gap-16 border-b border-muted-ash pb-16">
        <div className="flex flex-wrap items-center justify-between gap-12">
          <div className="min-w-0">
            <Button variant="text" onClick={() => router.back()} aria-label="Volver al vault" title="Volver">
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Volver</span>
            </Button>
            <h1 className="mt-1 truncate text-[22px] font-bold uppercase tracking-widest text-ghost-white">
              {prompt.title || 'Sin titulo'}
            </h1>
            <div className="mt-8 flex flex-wrap gap-5">
              <Badge variant="dim">{prompt.contentType}</Badge>
              <Badge variant="dim">{promptTypeLabel}</Badge>
              <ModelPill model={prompt.model} />
              {prompt.syncStatus === 'conflict' && <Badge variant="conflict">conflicto</Badge>}
              {prompt.syncStatus === 'pending_upload' && <Badge variant="pending">pendiente sync</Badge>}
              {prompt.syncStatus === 'local_only' && <Badge variant="offline">solo local</Badge>}
              {prompt.copyCount > 0 && <Badge variant="dim">copiado <span className="tabular-nums">{prompt.copyCount}</span>x</Badge>}
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-8 w-full md:w-auto">
            <div className="action-buttons flex gap-2">
              {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); resetForm(prompt) }} aria-label="Cancelar edicion" title="Cancelar">
                  <X size={16} aria-hidden="true" />
                </Button>
                <Button variant="primary" size="sm" loading={saving} onClick={handleSave} aria-label="Guardar cambios" title="Guardar cambios">
                  <Save size={16} aria-hidden="true" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" size="sm" onClick={handleCopy} aria-label="Copiar prompt" title={copied ? 'Copiado' : 'Copiar'}>
                  <Copy size={16} aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label="Editar prompt" title="Editar">
                  <Pencil size={16} aria-hidden="true" />
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} aria-label="Eliminar prompt" title="Eliminar">
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </>
            )}
            </div>
              <div className='action-menus flex gap-2'>
                
            {session?.user && (
              <ActionMenu
                id="ai"
                label="AI"
                icon={<BrainCircuit size={16} aria-hidden="true" />}
                disabled={!online || !!aiBusy}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
              >
                <MenuButton icon={<WandSparkles size={16} aria-hidden="true" />} onClick={handleMagicTouch} disabled={!online || !!aiBusy}>Edición Mágica</MenuButton>
                <MenuButton icon={<Languages size={16} aria-hidden="true" />} onClick={handleTranslatePrompt} disabled={!online || !!aiBusy}>Traducir prompt</MenuButton>
                <MenuButton icon={<Sparkles size={16} aria-hidden="true" />} onClick={handleVariations} disabled={!online || !!aiBusy}>3 Variantes</MenuButton>
                <MenuButton icon={<Zap size={16} aria-hidden="true" />} onClick={handleAdapt} disabled={!online || !!aiBusy}>Adaptar a modelo</MenuButton>
                <MenuButton icon={<Target size={16} aria-hidden="true" />} onClick={handleScore} disabled={!online || !!aiBusy}>Score de calidad</MenuButton>
              </ActionMenu>
            )}

            <ActionMenu
              id="share"
              label="Compartir"
              icon={<Share2 size={16} aria-hidden="true" />}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            >
              {session?.user && (
                <MenuButton icon={<Send size={16} aria-hidden="true" />} onClick={handlePublish} disabled={!online || publishing}>
                  {published ? 'Ya publicado' : 'Publicar en Prompterest'}
                </MenuButton>
              )}
              <MenuButton icon={<Download size={16} aria-hidden="true" />} onClick={handleExportPng}>Exportar PNG</MenuButton>
            </ActionMenu>

            <ActionMenu
              id="view"
              label="Vista"
              icon={<Eye size={16} aria-hidden="true" />}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            >
              <MenuButton icon={<Maximize2 size={16} aria-hidden="true" />} onClick={() => { setZenContent(null); setZenMode(true) }}>Modo zen</MenuButton>
              <MenuButton icon={<FileClock size={16} aria-hidden="true" />} onClick={handleShowVersions}>Versiones</MenuButton>
              <MenuButton icon={<Star size={16} aria-hidden="true" />} onClick={handleToggleFav}>{prompt.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}</MenuButton>
            </ActionMenu>
              </div>
          </div>
        </div>
      </header>

      <div className="grid gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-start">
        <main className="min-w-0">
          {editing ? (
            <EditPromptForm
              title={title}
              content={content}
              contentType={contentType}
              description={description}
              tagsRaw={tagsRaw}
              type={type}
              model={model}
              setTitle={setTitle}
              setContent={setContent}
              setContentType={setContentType}
              setDescription={setDescription}
              setTagsRaw={setTagsRaw}
              setType={setType}
              setModel={setModel}
            />
          ) : (
            <PromptReadPanel prompt={prompt} />
          )}
        </main>

        <aside className="min-w-0 xl:sticky xl:top-24">
          <ReferencePanel
            imageItems={imageItems}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            compareValue={compareValue}
            setCompareValue={setCompareValue}
            onFiles={handleAddImages}
            editing={editing}
            onDeleteImage={handleDeleteImage}
          />
        </aside>
      </div>

      {showVersions && (
        <VersionsPanel
          versions={versions}
          onClose={() => setShowVersions(false)}
          onRestore={handleRestoreVersion}
        />
      )}
    </section>
  )
}

function TranslationModal({
  open,
  result,
  copied,
  saving,
  onOpenChange,
  onCopy,
  onSaveBranch,
  onReadZen,
}: {
  open: boolean
  result: TranslationResult | null
  copied: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onCopy: () => void
  onSaveBranch: () => void
  onReadZen: () => void
}) {
  const translated = result?.translatedContent ?? ''

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Prompt en español"
      eyebrow="Traduccion"
      description="Revisa la traduccion antes de copiarla, guardarla como rama o leerla sin distracciones."
      size="xl"
      className="max-w-5xl"
      bodyClassName="overflow-x-hidden"
      footer={(
        <div className="grid w-full min-w-0 gap-8 sm:grid-cols-3">
          <Button type="button" variant="ghost" size="sm" className="min-w-0 whitespace-normal" onClick={onReadZen} disabled={!translated}>
            <Maximize2 size={16} aria-hidden="true" />
            Leer en Zen
          </Button>
          <Button type="button" variant="ghost" size="sm" className="min-w-0 whitespace-normal" onClick={onSaveBranch} loading={saving} disabled={!translated || saving}>
            <GitBranch size={16} aria-hidden="true" />
            Guardar rama
          </Button>
          <Button type="button" variant="primary" size="sm" className="min-w-0 whitespace-normal" onClick={onCopy} disabled={!translated}>
            <Copy size={16} aria-hidden="true" />
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      )}
    >
      <div className="grid min-w-0 gap-12">
        <div className="flex flex-wrap gap-6">
          {result?.detectedSourceLanguage && (
            <Badge variant="dim">origen: {result.detectedSourceLanguage}</Badge>
          )}
          <Badge variant="offline">rama local opcional</Badge>
        </div>

        {result?.notes && (
          <p className="rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12 text-[12px] leading-relaxed text-dim-gray">
            {result.notes}
          </p>
        )}

        {result?.warnings && result.warnings.length > 0 && (
          <div className="rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
            <p className="mb-6 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">Advertencias</p>
            <ul className="space-y-4 text-[12px] leading-relaxed text-dim-gray">
              {result.warnings.map((warning) => (
                <li key={warning}>- {warning}</li>
              ))}
            </ul>
          </div>
        )}

        <pre className="max-h-[min(58dvh,620px)] min-w-0 overflow-auto whitespace-pre-wrap wrap-break-word rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16 font-terminal text-[13px] leading-relaxed text-ghost-white">
          {translated || 'Sin traduccion disponible.'}
        </pre>
      </div>
    </AppModal>
  )
}

function MagicEditModal({
  open,
  mode,
  instruction,
  iterationInstruction,
  result,
  error,
  copied,
  workTitle,
  onOpenChange,
  onInstructionChange,
  onIterationInstructionChange,
  onSubmit,
  onRetry,
  onIterate,
  onSubmitIteration,
  onBackToResult,
  onChangeRequest,
  onCopy,
}: {
  open: boolean
  mode: MagicEditMode
  instruction: string
  iterationInstruction: string
  result: string
  error: string
  copied: boolean
  workTitle: string
  onOpenChange: (open: boolean) => void
  onInstructionChange: (value: string) => void
  onIterationInstructionChange: (value: string) => void
  onSubmit: () => void
  onRetry: () => void
  onIterate: () => void
  onSubmitIteration: () => void
  onBackToResult: () => void
  onChangeRequest: () => void
  onCopy: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isRequestMode = mode === 'request' || mode === 'iterateRequest'
  const isIterationRequest = mode === 'iterateRequest'

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Edición Mágica"
      eyebrow="Promptier AI"
      description={isIterationRequest
        ? 'Indica el siguiente ajuste sobre la versión recién editada. Esta pasada continúa desde el resultado actual.'
        : 'Describe el ajuste que quieres. La IA editará el prompt actual sin rehacerlo por completo, salvo que se lo pidas explícitamente.'}
      size="xl"
      initialFocusRef={isRequestMode ? textareaRef : undefined}
      className="max-w-4xl"
      bodyClassName="overflow-x-hidden"
      footer={(
        mode === 'result' ? (
          <div className="grid w-full min-w-0 gap-8 sm:grid-cols-2 xl:grid-cols-4">
            <Button type="button" variant="ghost" size="sm" className="min-w-0 whitespace-normal" onClick={onRetry}>
              <RotateCcw size={16} aria-hidden="true" />
              Otra versión
            </Button>
            <Button type="button" variant="ghost" size="sm" className="min-w-0 whitespace-normal" onClick={onIterate}>
              <WandSparkles size={16} aria-hidden="true" />
              Seguir puliendo
            </Button>
            <Button type="button" variant="ghost" size="sm" className="min-w-0 whitespace-normal" onClick={onChangeRequest}>
              <Pencil size={16} aria-hidden="true" />
              Ajustar pedido
            </Button>
            <Button type="button" variant="primary" size="sm" className="min-w-0 whitespace-normal" onClick={onCopy}>
              <Copy size={16} aria-hidden="true" />
              {copied ? 'Copiado' : 'Copiar resultado'}
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col-reverse gap-8 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={mode === 'loading'} className={isIterationRequest ? 'hidden' : ''}>
              Cerrar
            </Button>
            {isIterationRequest && (
              <Button type="button" variant="ghost" size="sm" onClick={onBackToResult}>
                Ver resultado
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={isIterationRequest ? onSubmitIteration : onSubmit}
              loading={mode === 'loading'}
            >
              <WandSparkles size={16} aria-hidden="true" />
              {isIterationRequest ? 'Pulir versión' : 'Crear edición'}
            </Button>
          </div>
        )
      )}
    >
      {mode === 'loading' ? (
        <MagicLoadingPanel title={workTitle} />
      ) : mode === 'result' ? (
        <div className="grid min-w-0 gap-12">
          <div className="grid min-w-0 gap-6 rounded-(--radius-card) border border-muted-ash bg-midnight-oil px-12 py-10 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start">
            <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray sm:pt-1">
              Pedido activo
            </p>
            <p className="min-w-0 whitespace-pre-wrap wrap-break-word text-[13px] leading-relaxed text-ghost-white" title={instruction}>
              {instruction}
            </p>
          </div>
          <pre className="max-h-[min(48dvh,440px)] min-w-0 overflow-auto whitespace-pre-wrap wrap-break-word rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16 font-terminal text-[13px] leading-relaxed text-ghost-white">
            {result}
          </pre>
        </div>
      ) : mode === 'iterateRequest' ? (
        <div className="grid min-w-0 gap-14">
          <div className="rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
            <p className="mb-8 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
              Versión actual
            </p>
            <pre className="max-h-44 min-w-0 overflow-auto whitespace-pre-wrap wrap-break-word font-terminal text-[12px] leading-relaxed text-ghost-white">
              {result}
            </pre>
          </div>
          <Textarea
            ref={textareaRef}
            label="Qué quieres pulir ahora"
            value={iterationInstruction}
            onChange={(event) => onIterationInstructionChange(event.target.value)}
            placeholder="Ej: Mantén esta versión, pero hazla más breve, más directa y con negativos más claros."
            rows={5}
            maxLength={1200}
            error={error}
          />
        </div>
      ) : (
        <div className="grid min-w-0 gap-14">
          <Textarea
            ref={textareaRef}
            label="Qué quieres editar"
            value={instruction}
            onChange={(event) => onInstructionChange(event.target.value)}
            placeholder="Ej: Hazlo más cinematográfico, conserva el sujeto y mejora iluminación, encuadre y negativos. No cambies el formato JSON."
            rows={7}
            maxLength={1200}
            error={error}
          />
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              'Conservar intención',
              'Editar, no rehacer',
              'Mantener formato',
            ].map((item) => (
              <div key={item} className="rounded-(--radius-card) border border-muted-ash bg-midnight-oil px-12 py-10 text-center font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppModal>
  )
}

function MagicLoadingPanel({ title }: { title: string }) {
  const messages = AI_MESSAGES['/api/ai/magic']
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length)
    }, 1200)
    return () => window.clearInterval(timer)
  }, [messages.length])

  return (
    <div className="grid min-h-72 place-items-center rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-20 text-center" role="status" aria-live="polite">
      <div className="w-full max-w-md">
        <MascotAnimation variant="loading" size="lg" crop="tight" className="mx-auto mb-10" />
        <p className="mb-8 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">Edición en curso</p>
        <h3 className="text-[18px] font-bold uppercase tracking-widest text-ghost-white">{title}</h3>
        <div className="mx-auto my-20 h-1 w-48 overflow-hidden rounded-full bg-muted-ash">
          <div className="motion-scanline h-full w-full" />
        </div>
        <p className="min-h-6 text-[13px] leading-relaxed text-dim-gray">
          {messages[messageIndex]}
        </p>
      </div>
    </div>
  )
}

function ActionMenu({
  id,
  label,
  icon,
  disabled = false,
  openMenu,
  setOpenMenu,
  children,
}: {
  id: string
  label: string
  icon: ReactNode
  disabled?: boolean
  openMenu: string | null
  setOpenMenu: (value: string | null) => void
  children: ReactNode
}) {
  const open = openMenu === id

  return (
    <div className="relative" data-action-menu-root>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpenMenu(open ? null : id)}
        className={[
          'motion-press inline-flex min-h-10 cursor-pointer items-center justify-center gap-8 rounded-(--radius-button) border px-8 py-8 font-terminal text-[13px]',
          open ? 'border-ghost-white bg-steel-gray text-ghost-white' : 'border-muted-ash text-ghost-white hover:border-ghost-white hover:bg-steel-gray',
          disabled ? 'cursor-not-allowed opacity-40' : '',
        ].join(' ')}
      >
        {icon}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={['transition-transform duration-200', open ? 'rotate-180' : ''].join(' ')}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="motion-panel absolute right-0 top-[calc(100%+8px)] z-50 grid w-[min(288px,calc(100vw-32px))] gap-4 rounded-(--radius-card) border border-muted-ash bg-steel-gray p-8"
        >
          {children}
        </div>
      )}
    </div>
  )
}

function MenuButton({
  children,
  icon,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        onClick()
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      }}
      className={[
        'motion-press inline-flex min-h-10 items-center gap-10 rounded-(--radius-button) px-12 py-8 text-left font-terminal text-[13px] disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'text-ghost-white hover:bg-midnight-oil' : 'text-dim-gray hover:bg-midnight-oil hover:text-ghost-white',
      ].join(' ')}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center text-ghost-white">{icon}</span>
      {children}
    </button>
  )
}

function PromptReadPanel({ prompt }: { prompt: LocalPrompt }) {
  return (
    <Card className="motion-panel">
      {prompt.description && (
        <p className="mb-16 max-w-4xl text-[13px] leading-relaxed text-dim-gray">
          {prompt.description}
        </p>
      )}
      <pre className="max-h-[min(68dvh,840px)] overflow-auto whitespace-pre-wrap rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16 font-terminal text-[13px] leading-relaxed text-ghost-white">
        {prompt.content}
      </pre>
      {prompt.tags.length > 0 && (
        <div className="mt-16 flex flex-wrap gap-5">
          {prompt.tags.map((tag) => <Badge key={tag} variant="dim">{tag}</Badge>)}
        </div>
      )}
    </Card>
  )
}

function EditPromptForm({
  title,
  content,
  contentType,
  description,
  tagsRaw,
  type,
  model,
  setTitle,
  setContent,
  setContentType,
  setDescription,
  setTagsRaw,
  setType,
  setModel,
}: {
  title: string
  content: string
  contentType: ContentType
  description: string
  tagsRaw: string
  type: PromptType
  model: string
  setTitle: (value: string) => void
  setContent: (value: string) => void
  setContentType: (value: ContentType) => void
  setDescription: (value: string) => void
  setTagsRaw: (value: string) => void
  setType: (value: PromptType) => void
  setModel: (value: string) => void
}) {
  return (
    <Card className="motion-panel flex flex-col gap-16">
      <Input label="Titulo" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
      <div className="flex flex-wrap gap-8">
        {CONTENT_TYPES.map((item) => (
          <Button key={item} variant={contentType === item ? 'filled' : 'ghost'} size="sm" onClick={() => setContentType(item)}>
            {item}
          </Button>
        ))}
      </div>
      <Textarea
        label="Contenido"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={16}
        className="text-[13px] leading-relaxed"
        spellCheck={false}
      />
      <Input label="Descripcion" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
      <Input label="Etiquetas (coma)" value={tagsRaw} onChange={(event) => setTagsRaw(event.target.value)} />
      <div className="flex flex-wrap gap-8">
        {PROMPT_TYPES.map((item) => (
          <Button key={item} variant={type === item ? 'filled' : 'ghost'} size="sm" onClick={() => setType(item)}>
            {item.replace('_', ' ')}
          </Button>
        ))}
      </div>
      <ModelTargetSelector value={model} onChange={setModel} />
    </Card>
  )
}

function ReferencePanel({
  imageItems,
  selectedImage,
  setSelectedImage,
  compareValue,
  setCompareValue,
  onFiles,
  editing,
  onDeleteImage,
}: {
  imageItems: PromptImageItem[]
  selectedImage: number
  setSelectedImage: (value: number) => void
  compareValue: number
  setCompareValue: (value: number) => void
  onFiles: (files: File[]) => Promise<void>
  editing: boolean
  onDeleteImage: (imageLocalId: string) => Promise<void>
}) {
  const selectedItem = imageItems[selectedImage]
  const selectedUrl = selectedItem?.url
  const hasMany = imageItems.length > 1

  return (
    <Card className="motion-panel flex flex-col gap-16">
      <div className="flex items-center justify-between gap-12">
        <div>
          <h2 className="font-terminal text-[14px] font-bold uppercase tracking-widest text-ghost-white">
            Referencias
          </h2>
          <p className="text-[12px] text-dim-gray">
            <span className="tabular-nums">{imageItems.length}</span> imagen{imageItems.length === 1 ? '' : 'es'} adjunta{imageItems.length === 1 ? '' : 's'}
          </p>
        </div>
        {hasMany && (
          <div className="flex gap-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedImage(selectedImage === 0 ? imageItems.length - 1 : selectedImage - 1)}
              aria-label="Imagen anterior"
              title="Imagen anterior"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedImage((selectedImage + 1) % imageItems.length)}
              aria-label="Imagen siguiente"
              title="Imagen siguiente"
            >
              <ArrowLeft size={16} aria-hidden="true" className="rotate-180" />
            </Button>
          </div>
        )}
      </div>

      {selectedUrl ? (
        <div className="motion-panel relative overflow-hidden rounded-(--radius-card) border border-muted-ash bg-midnight-oil">
          <img
            src={selectedUrl}
            alt={`Referencia ${selectedImage + 1}`}
            className="max-h-[68dvh] min-h-80 w-full object-contain"
          />
          {editing && selectedItem && (
            <Button
              variant="danger"
              size="sm"
              className="absolute right-8 top-8 min-h-9 px-10 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur"
              onClick={() => onDeleteImage(selectedItem.image.localId)}
              aria-label={`Quitar referencia ${selectedImage + 1}`}
              title="Quitar imagen"
            >
              <Trash2 size={15} aria-hidden="true" />
            </Button>
          )}
        </div>
      ) : (
        <div className="motion-skeleton grid min-h-80 place-items-center rounded-(--radius-card)">
          <p className="relative z-10 text-[12px] uppercase tracking-widest text-dim-gray">Sin imagenes</p>
        </div>
      )}

      {imageItems.length > 0 && (
        <div className="motion-list flex gap-8 overflow-x-auto pb-2">
          {imageItems.map(({ image, url }, index) => (
            <div
              key={`${image.localId}-${url}`}
              className="relative h-20 w-20 shrink-0"
              style={{ '--motion-index': index } as CSSProperties}
            >
              <button
                type="button"
                onClick={() => setSelectedImage(index)}
                className={[
                  'motion-press h-full w-full overflow-hidden rounded-(--radius-card) border bg-midnight-oil',
                  selectedImage === index ? 'border-ghost-white' : 'border-muted-ash opacity-70 hover:opacity-100',
                ].join(' ')}
                aria-label={`Ver referencia ${index + 1}`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void onDeleteImage(image.localId)
                  }}
                  className="motion-press absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-(--radius-button) border border-muted-ash bg-midnight-oil text-ghost-white shadow-[0_6px_16px_rgba(0,0,0,0.45)] hover:border-ghost-white hover:bg-steel-gray"
                  aria-label={`Quitar referencia ${index + 1}`}
                  title="Quitar imagen"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ImageUploader onFiles={onFiles} />

      {imageItems.length >= 2 && (
        <div className="space-y-8">
          <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">Comparar primeras dos referencias</p>
          <div className="relative aspect-video overflow-hidden rounded-(--radius-card) border border-muted-ash">
            <img src={imageItems[0].url} alt="Antes" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${compareValue}%` }}>
              <img src={imageItems[1].url} alt="Despues" className="h-full w-full object-cover" style={{ width: `${10000 / compareValue}%`, maxWidth: 'none' }} />
            </div>
            <div className="absolute inset-y-0 border-l border-ghost-white" style={{ left: `${compareValue}%` }} />
          </div>
          <input
            aria-label="Comparar antes y despues"
            className="w-full"
            type="range"
            min={1}
            max={99}
            value={compareValue}
            onChange={(event) => setCompareValue(Number(event.target.value))}
          />
        </div>
      )}
    </Card>
  )
}

function VersionsPanel({
  versions,
  onClose,
  onRestore,
}: {
  versions: LocalPromptVersion[]
  onClose: () => void
  onRestore: (version: LocalPromptVersion) => void
}) {
  return (
    <section className="motion-panel mt-24">
      <div className="mb-16 flex items-center justify-between gap-12">
        <h2 className="text-[14px] font-bold uppercase tracking-widest">Versiones anteriores</h2>
        <Button variant="text" size="sm" onClick={onClose}>Cerrar</Button>
      </div>
      {versions.length === 0 ? (
        <p className="text-[13px] text-dim-gray">Sin versiones guardadas aun.</p>
      ) : (
        <ul className="motion-list grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {versions.map((version, index) => (
            <li key={version.id} style={{ '--motion-index': index } as CSSProperties}>
              <Card interactive className="flex h-full flex-col gap-8">
                <div className="flex items-center justify-between gap-8">
                  <span className="text-[12px] text-dim-gray">{new Date(version.savedAt).toLocaleString('es')}</span>
                  <Button variant="ghost" size="sm" onClick={() => onRestore(version)} aria-label="Restaurar version" title="Restaurar">
                    <RotateCcw size={16} aria-hidden="true" />
                  </Button>
                </div>
                <pre className="line-clamp-4 font-terminal text-[12px] text-dim-gray">{version.content}</pre>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AiWorkOverlay({ work }: { work: AiWork | null }) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (!work) {
      setMessageIndex(0)
      return
    }
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % work.messages.length)
    }, 1350)
    return () => window.clearInterval(timer)
  }, [work])

  if (!work) return null

  return (
    <div className="fixed inset-0 z-95 grid place-items-center bg-midnight-oil/55 px-16 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="motion-modal-panel w-full max-w-lg rounded-(--radius-card) border border-muted-ash bg-steel-gray p-20 text-center">
        <MascotAnimation variant="loading" size="lg" crop="tight" className="mx-auto mb-10" />
        <p className="mb-8 font-terminal text-[12px] uppercase tracking-widest text-dim-gray">Promptier AI</p>
        <h2 className="text-[18px] font-bold uppercase tracking-widest text-ghost-white">{work.title}</h2>
        <div className="mx-auto my-20 h-1 w-48 overflow-hidden rounded-full bg-muted-ash">
          <div className="motion-scanline h-full w-full" />
        </div>
        <p className="min-h-6 text-[13px] leading-relaxed text-dim-gray">
          {work.messages[messageIndex]}
        </p>
      </div>
    </div>
  )
}

function AiResultBlock({ children, asParagraph = false }: { children: ReactNode; asParagraph?: boolean }) {
  if (asParagraph) {
    return (
      <p className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16 text-[13px] leading-relaxed text-ghost-white">
        {children}
      </p>
    )
  }

  return (
    <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16 font-terminal text-[13px] leading-relaxed text-ghost-white">
      {children}
    </pre>
  )
}
