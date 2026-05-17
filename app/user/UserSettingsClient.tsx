'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, KeyRound, RotateCcw, Shield, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAppModal } from '@/components/ui/Modal'
import { useMotionFeedback } from '@/components/ui/MotionProvider'

type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH'

type AiSettings = {
  hasGeminiKey: boolean
  keyPreview: string | null
  thinkingLevel: ThinkingLevel
  lastUsedAt: string | null
  lastValidatedAt: string | null
  status: string | null
  sharedQuotaRemaining: number
  sharedQuotaLimit: number
  sharedQuotaUsed: number
  sharedQuotaResetAt: string
}

type ProfileData = { nickname: string } | null

const thinkingOptions: Array<{ value: ThinkingLevel; label: string }> = [
  { value: 'MINIMAL', label: 'Minimal' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

function formatDate(value: string | null) {
  if (!value) return 'Sin registro'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function parseApiError(res: Response) {
  const data = await res.json().catch(() => ({})) as { error?: string }
  return data.error ?? 'No se pudo completar la accion.'
}

export function UserSettingsClient() {
  const feedback = useMotionFeedback()
  const modal = useAppModal()
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [profile, setProfile] = useState<ProfileData | undefined>(undefined)
  const [savingKey, setSavingKey] = useState(false)
  const [deletingKey, setDeletingKey] = useState(false)
  const [updatingThinking, setUpdatingThinking] = useState<ThinkingLevel | null>(null)
  const [error, setError] = useState('')

  const quotaPercent = useMemo(() => {
    if (!settings?.sharedQuotaLimit) return 0
    return Math.min(100, Math.round((settings.sharedQuotaUsed / settings.sharedQuotaLimit) * 100))
  }, [settings?.sharedQuotaLimit, settings?.sharedQuotaUsed])

  useEffect(() => {
    void loadSettings()
    fetch('/api/profile', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProfileData) => setProfile(data ?? null))
      .catch(() => setProfile(null))
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const res = await fetch('/api/user/ai-settings', { cache: 'no-store' })
      if (!res.ok) throw new Error(await parseApiError(res))
      setSettings(await res.json() as AiSettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuracion.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKey() {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      setError('Pega una API key de Gemini para guardarla.')
      return
    }

    setSavingKey(true)
    setError('')
    try {
      const res = await fetch('/api/user/gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      setSettings(await res.json() as AiSettings)
      setApiKey('')
      feedback.notify({ title: 'API key guardada', message: 'BYOK quedo activo para tus acciones de AI.', tone: 'success' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la API key.')
    } finally {
      setSavingKey(false)
    }
  }

  async function handleDeleteKey() {
    const confirmed = await modal.confirm({
      title: 'Eliminar API key',
      message: 'Promptier olvidara tu API key propia y volvera a usar la key compartida capada.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setDeletingKey(true)
    setError('')
    try {
      const res = await fetch('/api/user/gemini-key', { method: 'DELETE' })
      if (!res.ok) throw new Error(await parseApiError(res))
      setSettings(await res.json() as AiSettings)
      feedback.notify({ title: 'API key eliminada', message: 'Volviste al modo compartido.', tone: 'warning' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la API key.')
    } finally {
      setDeletingKey(false)
    }
  }

  async function handleThinkingChange(thinkingLevel: ThinkingLevel) {
    if (!settings?.hasGeminiKey) return

    setUpdatingThinking(thinkingLevel)
    setError('')
    try {
      const res = await fetch('/api/user/ai-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thinkingLevel }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      setSettings(await res.json() as AiSettings)
      feedback.notify({ title: 'Thinking actualizado', message: thinkingLevel, durationMs: 1800 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar thinking.')
    } finally {
      setUpdatingThinking(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-16">
        <div className="motion-skeleton h-32 rounded-(--radius-card)" />
        <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="motion-skeleton h-96 rounded-(--radius-card)" />
          <div className="motion-skeleton h-96 rounded-(--radius-card)" />
        </div>
      </div>
    )
  }

  const usingByok = !!settings?.hasGeminiKey
  const displayName = profile?.nickname ?? 'Cuenta'

  return (
    <section className="motion-page grid gap-16">
      {modal.modalNode}

      <header className="flex flex-col gap-8 border-b border-muted-ash pb-16">
        <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">Cuenta</p>
        <div className="flex flex-col justify-between gap-12 md:flex-row md:items-end">
          <div>
            <h1 className="text-[24px] font-bold uppercase tracking-widest text-ghost-white">{displayName}</h1>
            <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-dim-gray">
              Gestiona como Promptier usa Gemini para tus herramientas de AI.
            </p>
          </div>
          <StatusPill active={usingByok}>
            {usingByok ? 'API key propia activa' : 'Key compartida capada'}
          </StatusPill>
        </div>
      </header>

      {error && (
        <div className="rounded-(--radius-card) border border-ghost-white bg-midnight-oil p-12 text-[13px] text-ghost-white" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-16 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-16">
          <Card className="motion-panel grid gap-16">
            <div className="flex items-start justify-between gap-12">
              <div>
                <p className="mb-6 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">IA en Promptier</p>
                <h2 className="text-[18px] font-bold uppercase tracking-widest text-ghost-white">
                  {usingByok ? 'Usando tu API key Gemini' : 'Usando key compartida'}
                </h2>
              </div>
              <Shield size={22} aria-hidden="true" className="text-ghost-white" />
            </div>

            {!usingByok && settings && (
              <div className="grid gap-10 rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
                <p className="text-[13px] leading-relaxed text-dim-gray">
                  BYOK es altamente recomendado para una mejor experiencia con IA. La key compartida usa thinking LOW fijo y tiene limite diario.
                </p>
                <div>
                  <div className="mb-6 flex items-center justify-between gap-8 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
                    <span>Cuota compartida</span>
                    <span className="tabular-nums">{settings.sharedQuotaRemaining}/{settings.sharedQuotaLimit}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted-ash">
                    <div className="h-full bg-ghost-white transition-[width] duration-300" style={{ width: `${quotaPercent}%` }} />
                  </div>
                  <p className="mt-6 text-[12px] text-dim-gray">
                    Reinicia: {formatDate(settings.sharedQuotaResetAt)}
                  </p>
                </div>
              </div>
            )}

            {usingByok && settings && (
              <div className="grid gap-10 rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
                <InfoLine label="Clave guardada" value={settings.keyPreview ?? 'Activa'} />
                <InfoLine label="Validada" value={formatDate(settings.lastValidatedAt)} />
                <InfoLine label="Ultimo uso" value={formatDate(settings.lastUsedAt)} />
              </div>
            )}

            <div className="grid gap-10">
              <Input
                label={usingByok ? 'Cambiar API key Gemini' : 'Agregar API key Gemini'}
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value)
                  if (error) setError('')
                }}
                placeholder="Pega tu API key de Gemini"
                autoComplete="off"
              />
              <div className="flex flex-col gap-8 sm:flex-row">
                <Button variant="primary" size="sm" onClick={handleSaveKey} loading={savingKey} className="w-full sm:w-auto">
                  {usingByok ? <RotateCcw size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
                  {usingByok ? 'Rotar API key' : 'Activar BYOK'}
                </Button>
                {usingByok && (
                  <Button variant="danger" size="sm" onClick={handleDeleteKey} loading={deletingKey} className="w-full sm:w-auto">
                    <Trash2 size={16} aria-hidden="true" />
                    Eliminar key
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-8">
              <div className="flex items-center justify-between gap-8">
                <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
                  Thinking
                </p>
                {!usingByok && <span className="text-[12px] text-dim-gray">Disponible con API key propia</span>}
              </div>
              <div className="flex flex-col overflow-hidden rounded-(--radius-card) border border-muted-ash bg-midnight-oil sm:flex-row">
                {thinkingOptions.map((option) => {
                  const selected = settings?.thinkingLevel === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!usingByok || !!updatingThinking}
                      onClick={() => void handleThinkingChange(option.value)}
                      className={[
                        'motion-press flex min-h-11 flex-1 items-center justify-center gap-8 border-b border-muted-ash px-12 py-10 font-terminal text-[12px] uppercase tracking-widest sm:border-b-0 sm:border-r last:border-b-0 sm:last:border-r-0',
                        selected ? 'bg-ghost-white text-[var(--color-midnight-oil)]' : 'text-dim-gray hover:bg-steel-gray hover:text-ghost-white',
                        !usingByok ? 'cursor-not-allowed opacity-45' : '',
                      ].join(' ')}
                    >
                      {selected && <Check size={14} aria-hidden="true" />}
                      {updatingThinking === option.value ? '...' : option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>

          <Card className="motion-panel">
            <p className="mb-6 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">Proximamente</p>
            <p className="text-[13px] leading-relaxed text-dim-gray">
              Mas opciones si obtienes una API key Gemini de paga: generacion de imagenes dentro de Promptier, posibilidad de cambiar a Gemini 3.1 Pro y controles avanzados por modelo.
            </p>
          </Card>
        </div>

        <aside className="grid gap-16 xl:sticky xl:top-24">
          <Card className="motion-panel">
            <div className="mb-12 flex items-center gap-8">
              <Sparkles size={18} aria-hidden="true" />
              <h2 className="text-[15px] font-bold uppercase tracking-widest text-ghost-white">Estadisticas</h2>
            </div>
            <div className="grid gap-8">
              <Metric label="Acciones IA hoy" value={String(settings?.sharedQuotaUsed ?? 0)} />
              <Metric label="Modo actual" value={usingByok ? 'BYOK' : 'Compartido'} />
              <Metric label="Estado" value="Preparando mas metricas" />
            </div>
          </Card>

          <Card className="motion-panel">
            <p className="mb-6 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">Paso a paso</p>
            <h2 className="mb-12 text-[15px] font-bold uppercase tracking-widest text-ghost-white">
              Obtener tu API key Gemini gratis
            </h2>
            <div className="grid gap-8 text-[13px] leading-relaxed text-dim-gray">
              <p>
                Guia interactiva con tramos, checklists y espacios preparados para capturas de Google AI Studio.
              </p>
              <p>
                Incluye confirmacion de Free Tier, restricciones de seguridad y pasos para activar BYOK en Promptier.
              </p>
              <Link href="/guide">
                <Button variant="ghost" size="sm" className="mt-4 w-full justify-between">
                  Abrir guia
                  <ArrowRight size={15} aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </section>
  )
}

function StatusPill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={[
      'inline-flex w-fit items-center rounded-(--radius-button) border px-10 py-6 font-terminal text-[11px] uppercase tracking-widest',
      active ? 'border-ghost-white text-ghost-white' : 'border-muted-ash text-dim-gray',
    ].join(' ')}>
      {children}
    </span>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-8 text-[13px]">
      <span className="text-dim-gray">{label}</span>
      <span className="font-terminal text-ghost-white">{value}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
      <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">{label}</p>
      <p className="mt-6 text-[18px] font-bold uppercase tracking-widest text-ghost-white">{value}</p>
    </div>
  )
}
