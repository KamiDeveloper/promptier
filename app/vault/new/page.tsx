'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  FileImage,
  Image as ImageIcon,
  Loader2,
  ScanText,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { ImageUploader } from '@/components/images/ImageUploader'
import { ModelTargetSelector } from '@/components/models/ModelTargetSelector'
import { useMotionFeedback } from '@/components/ui/MotionProvider'
import { createPrompt } from '@/lib/db/repositories/promptRepository'
import { addPromptImage } from '@/lib/db/repositories/imageRepository'
import { listCollections } from '@/lib/db/repositories/collectionRepository'
import { createTemplate, listTemplates } from '@/lib/db/repositories/templateRepository'
import { useNetwork } from '@/lib/hooks/useNetwork'
import { normalizeModelValue } from '@/lib/models/modelTargets'
import { optimizeImage } from '@/lib/services/imageService'
import type { ContentType, LocalCollection, LocalTemplate, PromptType } from '@/lib/db/schema'

const CONTENT_TYPES: ContentType[] = ['text', 'markdown', 'json']
const PROMPT_TYPES: PromptType[] = ['image_generation', 'image_editing', 'other']

type ComposeMode = 'manual' | 'capture'
type SourceKind = 'screenshot_text' | 'generated_image' | 'mixed' | 'unknown'

type ExtractionResult = {
  extractedPrompt?: string
  title?: string
  description?: string
  detectedFormat?: ContentType
  sourceKind?: SourceKind
  shouldSaveSourceImage?: boolean
  tags?: string[]
  type?: PromptType
  model?: string
  confidence?: number
  warnings?: string[]
  error?: string
  code?: string
}

export default function NewPromptPage() {
  const router = useRouter()
  const { online } = useNetwork()
  const feedback = useMotionFeedback()
  const [mode, setMode] = useState<ComposeMode>('manual')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentType, setContentType] = useState<ContentType>('text')
  const [description, setDescription] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [type, setType] = useState<PromptType>('image_generation')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [collections, setCollections] = useState<LocalCollection[]>([])
  const [templates, setTemplates] = useState<LocalTemplate[]>([])
  const [collectionId, setCollectionId] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [captureFile, setCaptureFile] = useState<File | null>(null)
  const [capturePreviewUrl, setCapturePreviewUrl] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null)
  const [extractError, setExtractError] = useState('')
  const [saveCaptureSource, setSaveCaptureSource] = useState(false)

  useEffect(() => {
    void listCollections().then(setCollections)
    void listTemplates().then(setTemplates)
  }, [])

  useEffect(() => {
    if (!captureFile) {
      setCapturePreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(captureFile)
    setCapturePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [captureFile])

  const referencePreviews = useMemo(() => (
    imageFiles.map((file) => ({
      file,
      label: `${file.name} / ${formatBytes(file.size)}`,
    }))
  ), [imageFiles])

  function validate(): boolean {
    const nextErrors: Record<string, string> = {}
    if (!title.trim()) nextErrors.title = 'El titulo es requerido.'
    if (!content.trim()) nextErrors.content = 'El contenido es requerido.'
    if (!model.trim()) nextErrors.model = 'Selecciona Gemini, ChatGPT u Otro modelo.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const tags = tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean)
      const prompt = await createPrompt({
        title: title.trim(),
        content,
        contentType,
        description: description.trim() || undefined,
        tags,
        type,
        model: normalizeModelValue(model),
        collectionId: collectionId || undefined,
      })

      const filesToSave = [
        ...(saveCaptureSource && captureFile ? [captureFile] : []),
        ...imageFiles,
      ]

      for (const file of filesToSave) {
        await addPromptImage(prompt.localId, file)
      }

      router.push(`/vault/${prompt.localId}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveTemplate() {
    if (!title.trim() || !content.trim()) return
    const tags = tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean)
    const template = await createTemplate({
      name: title.trim(),
      content,
      contentType,
      tags,
    })
    setTemplates((previous) => [...previous, template].sort((a, b) => a.name.localeCompare(b.name)))
    feedback.notify({ title: 'Template guardado', message: template.name })
  }

  function applyTemplate(localId: string) {
    const template = templates.find((item) => item.localId === localId)
    if (!template) return
    setContent(template.content)
    setContentType(template.contentType)
    if (!tagsRaw) setTagsRaw(template.tags.join(', '))
  }

  async function handleSuggest() {
    if (!content.trim()) return
    if (!online) {
      setErrors({ content: 'AI no disponible sin conexion. Puedes guardar manualmente.' })
      return
    }
    setAiBusy(true)
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json().catch(() => ({})) as ExtractionResult
      if (!res.ok) {
        setErrors({ content: formatAiError(data, 'No se pudo sugerir metadata.') })
        return
      }
      applyExtraction(data, { preserveExistingTitle: true })
      feedback.notify({ title: 'Metadata sugerida', message: 'Revisa antes de guardar.' })
    } finally {
      setAiBusy(false)
    }
  }

  function handleCaptureSelected(files: FileList | null) {
    const file = Array.from(files ?? []).find((candidate) => candidate.type.startsWith('image/'))
    if (!file) return
    setMode('capture')
    setCaptureFile(file)
    setExtraction(null)
    setExtractError('')
    setSaveCaptureSource(false)
  }

  async function handleExtractFromCapture() {
    if (!captureFile || aiBusy) return
    if (!online) {
      setExtractError('Extraccion con Gemini no disponible sin conexion. El guardado manual sigue disponible.')
      return
    }

    setAiBusy(true)
    setExtractError('')
    try {
      const optimized = await optimizeImage(captureFile)
      if (optimized.dataUrl.length > 1_900_000) {
        setExtractError('La imagen optimizada sigue siendo demasiado grande para extraer. Prueba con una captura mas liviana.')
        return
      }

      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: optimized.dataUrl }),
      })
      const data = await res.json().catch(() => ({})) as ExtractionResult
      if (!res.ok) {
        setExtractError(formatAiError(data, 'Gemini no pudo leer la captura.'))
        return
      }

      setExtraction(data)
      applyExtraction(data)
      setSaveCaptureSource(data.sourceKind !== 'screenshot_text' && !!data.shouldSaveSourceImage)
      feedback.notify({ title: 'Extraccion lista', message: 'Revisa y corrige el prompt antes de guardar.' })
    } catch {
      setExtractError('No se pudo extraer la captura. Revisa la imagen e intenta de nuevo.')
    } finally {
      setAiBusy(false)
    }
  }

  function applyExtraction(data: ExtractionResult, options?: { preserveExistingTitle?: boolean }) {
    if (data.extractedPrompt) setContent(data.extractedPrompt)
    if ((!options?.preserveExistingTitle || !title.trim()) && data.title) setTitle(data.title)
    if (data.description) setDescription(data.description)
    if (data.detectedFormat) setContentType(data.detectedFormat)
    if (data.tags?.length) setTagsRaw(data.tags.join(', '))
    if (data.type) setType(data.type)
    if (data.model) setModel(normalizeModelValue(data.model))
    setErrors({})
  }

  const sourceIsTextOnly = extraction?.sourceKind === 'screenshot_text'
  const captureStatus = getCaptureStatus(extraction)

  return (
    <section className="motion-page min-w-0 overflow-x-hidden pb-32">
      <div className="mb-24 flex flex-col gap-16 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-widest text-dim-gray">Vault / composer</p>
          <h1 className="mt-3 text-[24px] font-bold uppercase tracking-widest text-ghost-white md:text-[32px]">
            Nuevo prompt
          </h1>
          <p className="mt-6 text-[13px] leading-relaxed text-dim-gray">
            Escribe desde cero o deja que Gemini lea una captura y prepare una base editable.
          </p>
        </div>
        <div className="flex flex-wrap gap-8">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </div>

      <div className="mb-16 grid min-w-0 gap-8 sm:grid-cols-2 xl:max-w-3xl">
        <ModeButton
          active={mode === 'manual'}
          icon={<Sparkles size={18} aria-hidden="true" />}
          title="Manual"
          description="Pega o escribe el prompt exacto."
          onClick={() => setMode('manual')}
        />
        <div className={mode === 'capture' ? 'sm:col-span-2 xl:hidden' : 'xl:hidden'}>
          {mode === 'capture' ? (
            <CaptureLab
              online={online}
              aiBusy={aiBusy && mode === 'capture'}
              captureFile={captureFile}
              capturePreviewUrl={capturePreviewUrl}
              extraction={extraction}
              extractError={extractError}
              saveCaptureSource={saveCaptureSource}
              sourceIsTextOnly={sourceIsTextOnly}
              captureStatus={captureStatus}
              contentType={contentType}
              onCaptureSelected={handleCaptureSelected}
              onClearCapture={() => {
                setCaptureFile(null)
                setExtraction(null)
                setExtractError('')
                setSaveCaptureSource(false)
              }}
              onExtract={handleExtractFromCapture}
              onSaveCaptureSourceChange={setSaveCaptureSource}
            />
          ) : (
            <ModeButton
              active={false}
              icon={<ScanText size={18} aria-hidden="true" />}
              title="Extraer desde captura"
              description={online ? 'Lee texto o replica una imagen.' : 'Requiere conexion para Gemini.'}
              disabled={!online}
              onClick={() => setMode('capture')}
            />
          )}
        </div>
        <div className="hidden xl:block">
          <ModeButton
            active={mode === 'capture'}
            icon={<ScanText size={18} aria-hidden="true" />}
            title="Extraer desde captura"
            description={online ? 'Lee texto o replica una imagen.' : 'Requiere conexion para Gemini.'}
            disabled={!online}
            onClick={() => setMode('capture')}
          />
        </div>
      </div>

      {!online && (
        <div className="mb-16 rounded-(--radius-card) border border-muted-ash bg-steel-gray p-12 text-[12px] leading-relaxed text-dim-gray">
          Gemini esta deshabilitado sin conexion. Puedes crear y guardar el prompt manualmente; la extraccion estara disponible cuando vuelvas online.
        </div>
      )}

      <div className="grid min-w-0 max-w-full gap-16 xl:grid-cols-[minmax(0,820px)_minmax(0,1fr)] xl:items-start">
        <Card className="motion-panel flex min-w-0 flex-col gap-16 overflow-hidden">
          <div className="grid min-w-0 gap-16 md:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              label="Titulo"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              error={errors.title}
              placeholder="Ej: Portrait dramatic lighting v2"
              maxLength={120}
            />

            <div className="flex flex-col gap-6">
              <span className="text-[12px] text-dim-gray uppercase tracking-widest">
                Formato
              </span>
              <div className="grid grid-cols-1 gap-6 min-[390px]:grid-cols-3">
                {CONTENT_TYPES.map((contentTypeOption) => (
                  <Button
                    key={contentTypeOption}
                    type="button"
                    variant={contentType === contentTypeOption ? 'filled' : 'ghost'}
                    size="sm"
                    onClick={() => setContentType(contentTypeOption)}
                    aria-pressed={contentType === contentTypeOption}
                    className="w-full px-8 text-[12px] sm:px-16 sm:text-[13px]"
                  >
                    {contentTypeOption}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <PromptContentField
            value={content}
            onChange={setContent}
            error={errors.content}
            placeholder={mode === 'capture'
              ? 'La extraccion aparecera aqui para que puedas corregirla antes de guardar.'
              : 'Pega aqui el prompt exacto. El formato se preserva exactamente.'}
            showSuggest={mode === 'manual'}
            suggestLoading={aiBusy && mode === 'manual'}
            suggestDisabled={!online || aiBusy || !content.trim()}
            onSuggest={handleSuggest}
          />

          <div className="grid min-w-0 gap-16 md:grid-cols-2">
            <Input
              label="Descripcion"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Notas sobre cuando usar este prompt"
              maxLength={500}
            />

            <Input
              label="Etiquetas"
              value={tagsRaw}
              onChange={(event) => setTagsRaw(event.target.value)}
              placeholder="retrato, iluminacion, v5"
            />
          </div>

          <div className="grid min-w-0 gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(240px,360px)]">
            <div className="flex flex-col gap-6">
              <span className="text-[12px] text-dim-gray uppercase tracking-widest">
                Tipo de prompt
              </span>
              <div className="flex flex-wrap gap-8">
                {PROMPT_TYPES.map((promptType) => (
                  <Button
                    key={promptType}
                    type="button"
                    variant={type === promptType ? 'filled' : 'ghost'}
                    size="sm"
                    onClick={() => setType(promptType)}
                    aria-pressed={type === promptType}
                  >
                    {promptType.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>

            {collections.length > 0 && (
              <div className="flex flex-col gap-6">
                <label className="text-[12px] text-dim-gray uppercase tracking-widest" htmlFor="collection">
                  Coleccion
                </label>
                <select
                  id="collection"
                  className="w-full min-w-0 rounded-(--radius-input) border border-muted-ash bg-steel-gray px-16 py-8 text-[14px]"
                  value={collectionId}
                  onChange={(event) => setCollectionId(event.target.value)}
                >
                  <option value="">Sin coleccion</option>
                  {collections.map((collection) => (
                    <option key={collection.localId} value={collection.localId}>{collection.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <ModelTargetSelector value={model} onChange={setModel} error={errors.model} />

          <div className="flex flex-col gap-6">
            <span className="text-[12px] text-dim-gray uppercase tracking-widest">
              Templates
            </span>
            <div className="flex min-w-0 flex-wrap gap-8">
              {templates.map((template) => (
                <Button key={template.localId} variant="ghost" size="sm" onClick={() => applyTemplate(template.localId)}>
                  {template.name}
                </Button>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={handleSaveTemplate}>
                Guardar como template
              </Button>
            </div>
          </div>
        </Card>

        <aside className="flex min-w-0 flex-col gap-16">
          <div className="hidden xl:block">
            <CaptureLab
              online={online}
              aiBusy={aiBusy && mode === 'capture'}
              captureFile={captureFile}
              capturePreviewUrl={capturePreviewUrl}
              extraction={extraction}
              extractError={extractError}
              saveCaptureSource={saveCaptureSource}
              sourceIsTextOnly={sourceIsTextOnly}
              captureStatus={captureStatus}
              contentType={contentType}
              onCaptureSelected={handleCaptureSelected}
              onClearCapture={() => {
                setCaptureFile(null)
                setExtraction(null)
                setExtractError('')
                setSaveCaptureSource(false)
              }}
              onExtract={handleExtractFromCapture}
              onSaveCaptureSourceChange={setSaveCaptureSource}
            />
          </div>

          <Card className="motion-panel flex min-w-0 flex-col gap-12 overflow-hidden">
            <div className="flex items-start justify-between gap-16">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-dim-gray">Referencias</p>
                <h2 className="mt-3 wrap-break-word text-[15px] font-bold uppercase tracking-widest text-ghost-white sm:text-[16px]">
                  Imagenes para guardar
                </h2>
              </div>
              <ImageIcon size={22} className="text-dim-gray" aria-hidden="true" />
            </div>

            <ImageUploader onFiles={(files) => setImageFiles((previous) => [...previous, ...files])} />

            {referencePreviews.length > 0 ? (
              <div className="space-y-8">
                {referencePreviews.map(({ file, label }, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-8 rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-10">
                    <div className="flex min-w-0 items-center gap-8">
                      <FileImage size={16} className="shrink-0 text-dim-gray" aria-hidden="true" />
                      <span className="truncate text-[12px] text-dim-gray">{label}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Quitar ${file.name}`}
                      onClick={() => setImageFiles((current) => current.filter((_, candidateIndex) => candidateIndex !== index))}
                      className="motion-press grid h-9 w-9 shrink-0 place-items-center rounded-(--radius-button) border border-muted-ash text-ghost-white hover:border-ghost-white"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] leading-relaxed text-dim-gray">
                Puedes adjuntar una o varias referencias despues de revisar la extraccion.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </section>
  )
}

function PromptContentField({
  value,
  onChange,
  error,
  placeholder,
  showSuggest,
  suggestLoading,
  suggestDisabled,
  onSuggest,
}: {
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder: string
  showSuggest: boolean
  suggestLoading: boolean
  suggestDisabled: boolean
  onSuggest: () => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <label htmlFor="prompt-content" className="text-[12px] text-dim-gray font-terminal uppercase tracking-widest">
        Contenido del prompt
      </label>
      <div className="relative min-w-0">
        <textarea
          id="prompt-content"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'prompt-content-error' : undefined}
          placeholder={placeholder}
          rows={11}
          spellCheck={false}
          className={[
            'motion-press w-full min-w-0 resize-y rounded-(--radius-input) border border-muted-ash bg-steel-gray px-16 py-8 font-terminal text-[13px] leading-relaxed text-ghost-white placeholder:text-dim-gray focus:border-ghost-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
            showSuggest ? 'pb-[58px]' : '',
            error ? 'border-ghost-white bg-midnight-oil' : '',
          ].join(' ')}
        />
        {showSuggest && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSuggest}
            loading={suggestLoading}
            disabled={suggestDisabled}
            className="absolute bottom-10 right-10 px-10 text-[12px] sm:px-16 sm:text-[13px]"
          >
            <Sparkles size={15} aria-hidden="true" />
            <span className="hidden min-[420px]:inline">Sugerir metadata</span>
            <span className="min-[420px]:hidden">Metadata</span>
          </Button>
        )}
      </div>
      {error && (
        <p id="prompt-content-error" className="text-[12px] text-ghost-white font-terminal" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}

function CaptureLab({
  online,
  aiBusy,
  captureFile,
  capturePreviewUrl,
  extraction,
  extractError,
  saveCaptureSource,
  sourceIsTextOnly,
  captureStatus,
  contentType,
  onCaptureSelected,
  onClearCapture,
  onExtract,
  onSaveCaptureSourceChange,
}: {
  online: boolean
  aiBusy: boolean
  captureFile: File | null
  capturePreviewUrl: string | null
  extraction: ExtractionResult | null
  extractError: string
  saveCaptureSource: boolean
  sourceIsTextOnly: boolean
  captureStatus: string
  contentType: ContentType
  onCaptureSelected: (files: FileList | null) => void
  onClearCapture: () => void
  onExtract: () => void
  onSaveCaptureSourceChange: (value: boolean) => void
}) {
  const captureInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <Card className="motion-panel flex min-w-0 flex-col gap-16 overflow-hidden">
      <div className="flex items-start justify-between gap-16">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-dim-gray">Gemini capture lab</p>
          <h2 className="mt-3 wrap-break-word text-[16px] font-bold uppercase tracking-widest text-ghost-white xl:text-[17px]">
            Extraer desde captura
          </h2>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-(--radius-button) border border-muted-ash">
          <ScanText size={20} aria-hidden="true" />
        </div>
      </div>

      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={!online || aiBusy}
        onChange={(event) => {
          onCaptureSelected(event.target.files)
          if (captureInputRef.current) captureInputRef.current.value = ''
        }}
      />

      <button
        type="button"
        disabled={!online || aiBusy}
        onClick={() => captureInputRef.current?.click()}
        className={[
          'motion-press min-h-48 rounded-(--radius-card) border border-dashed p-12 text-left sm:p-16',
          online ? 'border-muted-ash bg-midnight-oil hover:border-ghost-white' : 'cursor-not-allowed border-muted-ash bg-midnight-oil opacity-50',
        ].join(' ')}
      >
        {capturePreviewUrl ? (
          <img
            src={capturePreviewUrl}
            alt="Preview de captura"
            className="max-h-80 w-full rounded-(--radius-card) border border-muted-ash object-contain"
          />
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-10 text-center text-dim-gray">
            <Upload size={28} aria-hidden="true" />
            <span className="wrap-break-word text-[13px] text-ghost-white">Subir captura o imagen referencia</span>
            <span className="max-w-xs text-[11px] leading-relaxed">
              Texto visible, prompt en UI, o imagen generada que quieras replicar.
            </span>
          </div>
        )}
      </button>

      {captureFile && (
        <div className="flex flex-wrap items-center justify-between gap-8 text-[12px] text-dim-gray">
          <span className="min-w-0 truncate">{captureFile.name} / {formatBytes(captureFile.size)}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onClearCapture}>
            <Trash2 size={15} aria-hidden="true" />
            Quitar
          </Button>
        </div>
      )}

      {extractError && (
        <StatusPanel tone="danger" icon={<AlertTriangle size={16} aria-hidden="true" />}>
          {extractError}
        </StatusPanel>
      )}

      {!online && (
        <StatusPanel tone="warning" icon={<AlertTriangle size={16} aria-hidden="true" />}>
          La extraccion requiere conexion. El formulario manual sigue funcionando.
        </StatusPanel>
      )}

      {aiBusy && (
        <StatusPanel tone="default" icon={<Loader2 className="animate-spin" size={16} aria-hidden="true" />}>
          Leyendo la captura...
        </StatusPanel>
      )}

      {extraction && (
        <div className="space-y-10">
          <StatusPanel tone="success" icon={<Check size={16} aria-hidden="true" />}>
            {captureStatus}
          </StatusPanel>

          <div className="grid grid-cols-2 gap-8 text-[11px] text-dim-gray">
            <Metric label="Confianza" value={`${Math.round((extraction.confidence ?? 0) * 100)}%`} />
            <Metric label="Formato" value={extraction.detectedFormat ?? contentType} />
            <Metric label="Fuente" value={formatSourceKind(extraction.sourceKind)} />
            <Metric label="Tags" value={`${extraction.tags?.length ?? 0}`} />
          </div>

          {extraction.warnings && extraction.warnings.length > 0 && (
            <div className="rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
              <p className="mb-6 text-[11px] uppercase tracking-widest text-dim-gray">Advertencias</p>
              <ul className="space-y-4 text-[12px] leading-relaxed text-dim-gray">
                {extraction.warnings.map((warning) => (
                  <li key={warning}>- {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {!sourceIsTextOnly && captureFile && (
            <label className="motion-press flex cursor-pointer items-start gap-10 rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12 text-[12px] leading-relaxed text-dim-gray">
              <input
                type="checkbox"
                checked={saveCaptureSource}
                onChange={(event) => onSaveCaptureSourceChange(event.target.checked)}
                className="mt-1 h-4 w-4 accent-ghost-white"
              />
              <span>
                Guardar esta imagen como referencia local junto al prompt.
              </span>
            </label>
          )}

          {sourceIsTextOnly && (
            <p className="text-[12px] leading-relaxed text-dim-gray">
              La captura parece contener solo texto de prompt, asi que no se guardara como referencia visual.
            </p>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="sm"
        loading={aiBusy}
        disabled={!online || !captureFile || aiBusy}
        onClick={onExtract}
      >
        <ScanText size={16} aria-hidden="true" />
        Extraer prompt
      </Button>
    </Card>
  )
}

function ModeButton({
  active,
  icon,
  title,
  description,
  disabled,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  title: string
  description: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={[
        'motion-press flex min-h-22 min-w-0 items-start gap-10 rounded-(--radius-card) border p-12 text-left sm:gap-12 sm:p-14',
        active
          ? 'border-ghost-white bg-steel-gray text-ghost-white'
          : 'border-muted-ash bg-midnight-oil text-dim-gray hover:border-ghost-white hover:text-ghost-white',
        disabled ? 'cursor-not-allowed opacity-45' : '',
      ].join(' ')}
    >
      <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-(--radius-button) border border-muted-ash">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block wrap-break-word text-[12px] font-bold uppercase tracking-widest sm:text-[13px]">{title}</span>
        <span className="mt-3 block wrap-break-word text-[11px] leading-relaxed text-dim-gray sm:text-[12px]">{description}</span>
      </span>
    </button>
  )
}

function StatusPanel({
  tone,
  icon,
  children,
}: {
  tone: 'default' | 'success' | 'warning' | 'danger'
  icon: ReactNode
  children: ReactNode
}) {
  const toneClass = {
    default: 'border-muted-ash bg-midnight-oil text-dim-gray',
    success: 'border-ghost-white bg-midnight-oil text-ghost-white',
    warning: 'border-dim-gray bg-midnight-oil text-dim-gray',
    danger: 'border-ghost-white bg-midnight-oil text-ghost-white',
  }[tone]

  return (
    <div className={`flex items-start gap-8 rounded-(--radius-card) border p-12 text-[12px] leading-relaxed ${toneClass}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 wrap-break-word">{children}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-10">
      <span className="block uppercase tracking-widest">{label}</span>
      <span className="mt-3 block truncate text-ghost-white">{value}</span>
    </div>
  )
}

function formatAiError(data: ExtractionResult, fallback: string) {
  const sharedLimit = data.code === 'SHARED_AI_DAILY_LIMIT' || data.code === 'SHARED_AI_RATE_LIMIT'
  if (sharedLimit) {
    return `${data.error ?? 'Limite de AI compartida alcanzado.'} Configura tu API key propia en /user.`
  }
  return data.error ?? fallback
}

function getCaptureStatus(extraction: ExtractionResult | null) {
  if (!extraction) return ''
  if (extraction.sourceKind === 'screenshot_text') return 'Prompt textual detectado y transcrito.'
  if (extraction.sourceKind === 'generated_image') return 'Referencia visual convertida en prompt replicable.'
  if (extraction.sourceKind === 'mixed') return 'Texto e imagen combinados en una extraccion editable.'
  return 'Extraccion completada. Revisa los campos antes de guardar.'
}

function formatSourceKind(sourceKind?: SourceKind) {
  const labels: Record<SourceKind, string> = {
    screenshot_text: 'texto',
    generated_image: 'imagen',
    mixed: 'mixta',
    unknown: 'incierta',
  }
  return labels[sourceKind ?? 'unknown']
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
