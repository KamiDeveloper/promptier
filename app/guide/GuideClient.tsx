'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Gauge,
  ImageIcon,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'

type ChecklistItem = {
  id: string
  label: string
}

type GuideStage = {
  id: string
  eyebrow: string
  title: string
  summary: string
  imageTitle: string
  imageDescription: string
  checklist: ChecklistItem[]
  tip: string
  primaryAction?: {
    label: string
    href: string
    external?: boolean
  }
}

type Issue = {
  problem: string
  meaning: string
  fix: string
}

const STORAGE_KEY = 'promptier-gemini-guide-checklist-v1'

const guideStages: GuideStage[] = [
  {
    id: 'preparacion',
    eyebrow: 'Tramo 01',
    title: 'Antes de entrar',
    summary: 'Deja claro que necesitas, que no debes tocar y como evitar cargos accidentales.',
    imageTitle: 'Preparacion previa',
    imageDescription: 'Aqui ira una captura o mini infografia con cuenta de Google, region compatible y nota de Free Tier.',
    tip: 'Si solo quieres el nivel gratuito, no configures facturacion. Ese boton es para pasar a un plan pagado.',
    checklist: [
      { id: 'prep-account', label: 'Tengo una cuenta de Google lista para usar.' },
      { id: 'prep-age', label: 'Confirmo que tengo al menos 18 anos.' },
      { id: 'prep-region', label: 'Estoy en una region compatible con Google AI Studio y Gemini API.' },
      { id: 'prep-billing', label: 'No voy a configurar facturacion si solo quiero Free Tier.' },
    ],
  },
  {
    id: 'aistudio',
    eyebrow: 'Tramo 02',
    title: 'Entrar a Google AI Studio',
    summary: 'Abre AI Studio, inicia sesion y acepta terminos si Google lo pide por primera vez.',
    imageTitle: 'Pantalla inicial de Google AI Studio',
    imageDescription: 'Aqui ira una captura de ai.dev con el boton Get API key visible, o su ubicacion dentro del menu en mobile.',
    tip: 'En cuentas nuevas, Google puede crear automaticamente un proyecto de Google Cloud y una API key por defecto.',
    primaryAction: {
      label: 'Abrir Google AI Studio',
      href: 'https://ai.dev',
      external: true,
    },
    checklist: [
      { id: 'studio-open', label: 'Entre a Google AI Studio desde ai.dev.' },
      { id: 'studio-login', label: 'Inicie sesion con mi cuenta de Google.' },
      { id: 'studio-terms', label: 'Acepte los terminos si aparecieron.' },
      { id: 'studio-get-key', label: 'Ubique el boton Get API key / Obtener clave API.' },
    ],
  },
  {
    id: 'crear-clave',
    eyebrow: 'Tramo 03',
    title: 'Crear o encontrar la clave',
    summary: 'Ve a API Keys, crea una clave nueva o copia la que AI Studio genero por defecto.',
    imageTitle: 'Seccion API Keys',
    imageDescription: 'Aqui ira una captura de la tabla API Keys y del boton Create API key / Crear clave de API.',
    tip: 'Para principiantes, lo mas simple es crearla en un proyecto nuevo con un nombre claro como Gemini-Free-Test.',
    checklist: [
      { id: 'keys-section', label: 'Entre a API Keys / Claves de API.' },
      { id: 'keys-create', label: 'Use Create API key o elegi la clave creada por defecto.' },
      { id: 'keys-project', label: 'La asocie a un proyecto nuevo o a uno existente con permisos.' },
      { id: 'keys-copy', label: 'Copie la clave usando el icono de copiar.' },
    ],
  },
  {
    id: 'free-tier',
    eyebrow: 'Tramo 04',
    title: 'Confirmar Free Tier',
    summary: 'Verifica que el proyecto este en nivel gratuito y revisa los limites reales de tu cuenta.',
    imageTitle: 'Columna Billing Tier',
    imageDescription: 'Aqui ira una captura donde se vea Billing Tier / Nivel de facturacion con Free tier / Nivel gratuito.',
    tip: 'Los limites se aplican por proyecto, no por cada clave individual. Revisa requests por minuto, tokens por minuto y requests por dia.',
    primaryAction: {
      label: 'Ver limites oficiales',
      href: 'https://ai.google.dev/gemini-api/docs/rate-limits',
      external: true,
    },
    checklist: [
      { id: 'free-column', label: 'En Billing Tier aparece Free tier o Nivel gratuito.' },
      { id: 'free-no-billing', label: 'No pulse Configurar la facturacion.' },
      { id: 'free-limits', label: 'Revise la pagina de rate limits o uso activo.' },
      { id: 'free-paid-aware', label: 'Entiendo que Paid Tier requiere facturacion y puede pedir prepago.' },
    ],
  },
  {
    id: 'seguridad',
    eyebrow: 'Tramo 05',
    title: 'Proteger la clave',
    summary: 'Restringe la clave a Gemini API y tratala como una contrasena tecnica.',
    imageTitle: 'Restrict to Gemini API',
    imageDescription: 'Aqui ira una captura del aviso de seguridad o del control para restringir la API key a Gemini API.',
    tip: 'Google aviso que las claves sin restricciones son vulnerables y que el trafico con claves no restringidas puede dejar de funcionar para Gemini API.',
    primaryAction: {
      label: 'Leer seguridad de API keys',
      href: 'https://ai.google.dev/gemini-api/docs/api-key',
      external: true,
    },
    checklist: [
      { id: 'secure-restrict', label: 'Restrinji la clave a Gemini API.' },
      { id: 'secure-manager', label: 'Guarde la clave en un gestor de contrasenas o lugar seguro.' },
      { id: 'secure-private', label: 'No la comparti en capturas, GitHub, Discord, YouTube ni chats publicos.' },
      { id: 'secure-rotate', label: 'Se como crear una nueva clave si sospecho que se filtro.' },
    ],
  },
  {
    id: 'promptier',
    eyebrow: 'Tramo 06',
    title: 'Usarla en Promptier',
    summary: 'Pega tu clave en Promptier, activa BYOK y ajusta thinking cuando la validacion termine.',
    imageTitle: 'Pagina /user de Promptier',
    imageDescription: 'Aqui ira una captura del panel IA en Promptier mostrando el input para agregar o rotar la API key.',
    tip: 'Promptier no vuelve a mostrar tu clave. La cifra server-side y solo ensena una vista previa segura.',
    primaryAction: {
      label: 'Ir a configuracion de IA',
      href: '/user',
    },
    checklist: [
      { id: 'promptier-open-user', label: 'Entre a /user en Promptier.' },
      { id: 'promptier-paste', label: 'Pegue la API key de Gemini en el campo correspondiente.' },
      { id: 'promptier-save', label: 'Active BYOK y espere la validacion.' },
      { id: 'promptier-thinking', label: 'Configure thinking si quiero MINIMAL, LOW, MEDIUM o HIGH.' },
    ],
  },
]

const finalChecklist: ChecklistItem[] = [
  { id: 'final-studio', label: 'Entre a Google AI Studio con mi cuenta de Google.' },
  { id: 'final-created', label: 'Cree o encontre una API key.' },
  { id: 'final-free-tier', label: 'En Nivel de facturacion aparece Nivel gratuito o Free tier.' },
  { id: 'final-no-billing', label: 'No configure facturacion si solo quiero usar el plan gratis.' },
  { id: 'final-saved', label: 'Copie la clave y la guarde en un lugar seguro.' },
  { id: 'final-restricted', label: 'Restringi la clave a Gemini API.' },
  { id: 'final-private', label: 'No comparti la clave en capturas, repos, chats ni paginas publicas.' },
  { id: 'final-limits', label: 'Revise mis limites de uso en Google AI Studio.' },
]

const commonIssues: Issue[] = [
  {
    problem: 'No aparece Create API key',
    meaning: 'Puede faltar permiso para crear claves o habilitar servicios en ese proyecto.',
    fix: 'Usa una cuenta personal o crea un proyecto nuevo fuera de una organizacion.',
  },
  {
    problem: 'Aparece Free tier, pero falla',
    meaning: 'Puede ser limite, region, modelo no disponible o clave mal configurada.',
    fix: 'Revisa rate limits, modelo usado, region y estado de la clave.',
  },
  {
    problem: 'Error 429 / RESOURCE_EXHAUSTED',
    meaning: 'Hiciste demasiadas solicitudes o superaste el limite activo.',
    fix: 'Espera, reduce solicitudes o revisa los limites del modelo en AI Studio.',
  },
  {
    problem: 'Error 403 / PERMISSION_DENIED',
    meaning: 'La clave no tiene acceso correcto o estas usando la clave equivocada.',
    fix: 'Verifica que pegaste la clave correcta y que pertenece al proyecto correcto.',
  },
  {
    problem: 'Clave bloqueada o filtrada',
    meaning: 'Google pudo detectar que la clave fue expuesta o vulnerable.',
    fix: 'Crea una nueva, elimina la vieja y restringe la nueva a Gemini API.',
  },
]

const officialLinks = [
  { label: 'API keys', href: 'https://ai.google.dev/gemini-api/docs/api-key' },
  { label: 'Pricing', href: 'https://ai.google.dev/gemini-api/docs/pricing' },
  { label: 'Billing', href: 'https://ai.google.dev/gemini-api/docs/billing' },
  { label: 'Regiones', href: 'https://ai.google.dev/gemini-api/docs/available-regions' },
  { label: 'Troubleshooting', href: 'https://ai.google.dev/gemini-api/docs/troubleshooting' },
]

export function GuideClient() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [activeStageId, setActiveStageId] = useState(guideStages[0]?.id ?? '')
  const [hasHydrated, setHasHydrated] = useState(false)
  const stageRefs = useRef<Record<string, HTMLElement | null>>({})

  const allItems = useMemo(
    () => [...guideStages.flatMap((stage) => stage.checklist), ...finalChecklist],
    [],
  )

  const checkedCount = allItems.reduce((count, item) => count + (checked[item.id] ? 1 : 0), 0)
  const progressPercent = allItems.length ? Math.round((checkedCount / allItems.length) * 100) : 0
  const activeStage = guideStages.find((stage) => stage.id === activeStageId) ?? guideStages[0]

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) setChecked(JSON.parse(stored) as Record<string, boolean>)
    } catch {
      setChecked({})
    } finally {
      setHasHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hasHydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked))
  }, [checked, hasHydrated])

  function toggleItem(id: string) {
    setChecked((current) => ({ ...current, [id]: !current[id] }))
  }

  function selectStage(id: string) {
    setActiveStageId(id)
    stageRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function resetProgress() {
    setChecked({})
  }

  return (
    <section className="motion-page grid gap-20">
      <header className="grid gap-16 border-b border-muted-ash pb-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="max-w-5xl">
          <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
            Gemini Free Tier / Mayo 2026
          </p>
          <h1 className="mt-8 text-[32px] font-bold uppercase leading-tight tracking-normal text-ghost-white sm:text-[44px] lg:text-[56px]">
            Guia para obtener tu API key de Gemini
          </h1>
          <p className="mt-12 max-w-4xl text-[13px] leading-relaxed text-dim-gray sm:text-[15px]">
            Un recorrido por tramos para crear tu clave, confirmar el nivel gratuito, protegerla y activarla en Promptier sin perderte en Google AI Studio.
          </p>
        </div>

        <div className="rounded-(--radius-card) border border-muted-ash bg-steel-gray p-16">
          <div className="mb-8 flex justify-end">
            <MascotAnimation variant="flexing" size="md" crop="tight" />
          </div>
          <div className="mb-10 flex items-center justify-between gap-8">
            <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">Progreso</p>
            <span className="tabular-nums text-[18px] font-bold text-ghost-white">{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted-ash">
            <div
              className="h-full bg-ghost-white transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-8 text-[12px] text-dim-gray">
            {checkedCount}/{allItems.length} checks completados
          </p>
          <Button variant="ghost" size="sm" onClick={resetProgress} className="mt-12 w-full">
            <RotateCcw size={15} aria-hidden="true" />
            Reiniciar checklist
          </Button>
        </div>
      </header>

      <div className="grid gap-20 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
        <aside className="xl:sticky xl:top-[96px]">
          <div className="grid gap-10 rounded-(--radius-card) border border-muted-ash bg-steel-gray p-12">
            <p className="px-4 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
              Tramos
            </p>
            <div className="grid gap-6">
              {guideStages.map((stage, index) => {
                const done = stage.checklist.every((item) => checked[item.id])
                const active = activeStageId === stage.id
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => selectStage(stage.id)}
                    aria-current={active ? 'step' : undefined}
                    className={[
                      'motion-press flex items-center gap-10 rounded-(--radius-button) border px-10 py-9 text-left',
                      active ? 'border-ghost-white bg-midnight-oil text-ghost-white' : 'border-transparent text-dim-gray hover:border-muted-ash hover:text-ghost-white',
                    ].join(' ')}
                  >
                    <span className={[
                      'grid h-7 w-7 shrink-0 place-items-center rounded-(--radius-button) border font-terminal text-[11px]',
                      done ? 'border-ghost-white bg-ghost-white text-[var(--color-midnight-oil)]' : 'border-muted-ash',
                    ].join(' ')}>
                      {done ? <Check size={13} aria-hidden="true" /> : String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-bold uppercase tracking-widest">
                        {stage.title}
                      </span>
                      <span className="block text-[11px] text-dim-gray">
                        {stage.checklist.filter((item) => checked[item.id]).length}/{stage.checklist.length}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-12 rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
            <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">Tramo activo</p>
            <p className="mt-4 text-[13px] font-bold uppercase tracking-widest text-ghost-white">
              {activeStage.title}
            </p>
            <p className="mt-8 text-[12px] leading-relaxed text-dim-gray">{activeStage.tip}</p>
          </div>
        </aside>

        <div className="grid gap-16">
          {guideStages.map((stage, index) => (
            <StageCard
              key={stage.id}
              refSetter={(node) => {
                stageRefs.current[stage.id] = node
              }}
              stage={stage}
              index={index}
              checked={checked}
              active={activeStageId === stage.id}
              onFocusStage={() => setActiveStageId(stage.id)}
              onToggle={toggleItem}
            />
          ))}

          <section className="motion-panel rounded-(--radius-card) border border-muted-ash bg-steel-gray p-16 sm:p-20">
            <div className="mb-16 flex flex-col justify-between gap-10 md:flex-row md:items-start">
              <div>
                <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
                  Checklist final
                </p>
                <h2 className="mt-6 text-[20px] font-bold uppercase tracking-widest text-ghost-white">
                  Antes de pegar la clave
                </h2>
              </div>
              <ClipboardCheck size={24} aria-hidden="true" className="text-ghost-white" />
            </div>
            <Checklist items={finalChecklist} checked={checked} onToggle={toggleItem} columns />
          </section>

          <section className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="motion-panel rounded-(--radius-card) border border-muted-ash bg-steel-gray p-16 sm:p-20">
              <div className="mb-16 flex items-center gap-10">
                <AlertTriangle size={20} aria-hidden="true" />
                <h2 className="text-[18px] font-bold uppercase tracking-widest text-ghost-white">
                  Errores comunes
                </h2>
              </div>
              <div className="grid gap-10">
                {commonIssues.map((issue) => (
                  <article key={issue.problem} className="rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
                    <h3 className="text-[13px] font-bold uppercase tracking-widest text-ghost-white">
                      {issue.problem}
                    </h3>
                    <p className="mt-6 text-[12px] leading-relaxed text-dim-gray">{issue.meaning}</p>
                    <p className="mt-6 text-[12px] leading-relaxed text-ghost-white">{issue.fix}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="grid gap-16">
              <div className="motion-panel rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16">
                <div className="mb-10 flex items-center gap-8">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <h2 className="text-[15px] font-bold uppercase tracking-widest text-ghost-white">
                    Regla de oro
                  </h2>
                </div>
                <p className="text-[13px] leading-relaxed text-dim-gray">
                  Una API key es una contrasena tecnica. Si se filtra, rota la clave: crea una nueva, elimina la anterior y vuelve a restringirla a Gemini API.
                </p>
              </div>

              <div className="motion-panel rounded-(--radius-card) border border-muted-ash bg-steel-gray p-16">
                <p className="mb-10 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
                  Fuentes oficiales
                </p>
                <div className="grid gap-6">
                  {officialLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="motion-press flex items-center justify-between gap-8 rounded-(--radius-button) border border-muted-ash px-10 py-8 text-[12px] text-dim-gray hover:border-ghost-white hover:text-ghost-white"
                    >
                      {link.label}
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>
    </section>
  )
}

function StageCard({
  stage,
  index,
  checked,
  active,
  refSetter,
  onFocusStage,
  onToggle,
}: {
  stage: GuideStage
  index: number
  checked: Record<string, boolean>
  active: boolean
  refSetter: (node: HTMLElement | null) => void
  onFocusStage: () => void
  onToggle: (id: string) => void
}) {
  const doneCount = stage.checklist.filter((item) => checked[item.id]).length
  const complete = doneCount === stage.checklist.length

  return (
    <article
      ref={refSetter}
      onMouseEnter={onFocusStage}
      className={[
        'motion-panel scroll-mt-28 overflow-hidden rounded-(--radius-card) border bg-steel-gray transition-colors duration-300',
        active ? 'border-ghost-white' : 'border-muted-ash',
      ].join(' ')}
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(320px,0.76fr)]">
        <div className="grid gap-16 p-16 sm:p-20">
          <div className="flex flex-col justify-between gap-12 md:flex-row md:items-start">
            <div className="min-w-0">
              <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
                {stage.eyebrow}
              </p>
              <h2 className="mt-6 text-[22px] font-bold uppercase leading-tight tracking-widest text-ghost-white">
                {stage.title}
              </h2>
              <p className="mt-10 max-w-3xl text-[13px] leading-relaxed text-dim-gray">
                {stage.summary}
              </p>
            </div>
            <div className="flex w-fit items-center gap-8 rounded-(--radius-button) border border-muted-ash px-10 py-7 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
              {complete ? <CheckCircle2 size={14} aria-hidden="true" /> : <Gauge size={14} aria-hidden="true" />}
              {doneCount}/{stage.checklist.length}
            </div>
          </div>

          <Checklist items={stage.checklist} checked={checked} onToggle={onToggle} />

          <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
            {stage.primaryAction && (
              <ActionLink action={stage.primaryAction} />
            )}
            <div className="rounded-(--radius-button) border border-muted-ash px-10 py-8 text-[12px] leading-relaxed text-dim-gray">
              {stage.tip}
            </div>
          </div>
        </div>

        <ImagePlaceholder
          index={index}
          title={stage.imageTitle}
          description={stage.imageDescription}
        />
      </div>
    </article>
  )
}

function Checklist({
  items,
  checked,
  onToggle,
  columns = false,
}: {
  items: ChecklistItem[]
  checked: Record<string, boolean>
  onToggle: (id: string) => void
  columns?: boolean
}) {
  return (
    <div className={columns ? 'grid gap-8 md:grid-cols-2' : 'grid gap-8'}>
      {items.map((item) => {
        const complete = !!checked[item.id]
        return (
          <button
            key={item.id}
            type="button"
            role="checkbox"
            aria-checked={complete}
            onClick={() => onToggle(item.id)}
            className={[
              'motion-press flex cursor-pointer items-start gap-10 rounded-(--radius-button) border p-10 text-left',
              complete ? 'border-ghost-white bg-midnight-oil text-ghost-white' : 'border-muted-ash bg-midnight-oil text-dim-gray hover:border-dim-gray hover:text-ghost-white',
            ].join(' ')}
          >
            <span
              className={[
                'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[6px] border transition-colors',
                complete ? 'border-ghost-white bg-ghost-white text-[var(--color-midnight-oil)]' : 'border-muted-ash text-transparent',
              ].join(' ')}
              aria-hidden="true"
            >
              <Check size={14} />
            </span>
            <span className="text-[13px] leading-relaxed">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ImagePlaceholder({
  index,
  title,
  description,
}: {
  index: number
  title: string
  description: string
}) {
  return (
    <div className="relative min-h-[280px] overflow-hidden border-t border-muted-ash bg-midnight-oil p-16 lg:border-l lg:border-t-0">
      <div className="absolute inset-0 grid grid-cols-8 gap-px opacity-[0.08]" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, cellIndex) => (
          <div key={cellIndex} className="border border-ghost-white/20" />
        ))}
      </div>
      <div className="relative flex h-full min-h-[248px] flex-col justify-between rounded-(--radius-card) border border-dashed border-muted-ash bg-steel-gray/40 p-16">
        <div className="flex items-center justify-between gap-8">
          <span className="rounded-(--radius-button) border border-muted-ash px-8 py-5 font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
            Captura {String(index + 1).padStart(2, '0')}
          </span>
          <ImageIcon size={20} aria-hidden="true" className="text-dim-gray" />
        </div>
        <div className="my-18 flex flex-1 items-center justify-center">
          <div className="aspect-video w-full max-w-[420px] rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-12">
            <div className="flex h-full flex-col justify-between border border-muted-ash p-10">
              <div className="grid gap-5">
                <div className="h-2 w-2/3 bg-muted-ash" />
                <div className="h-2 w-1/2 bg-muted-ash" />
              </div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-(--radius-card) border border-muted-ash">
                <ImageIcon size={24} aria-hidden="true" />
              </div>
              <div className="grid gap-5">
                <div className="h-2 w-full bg-muted-ash" />
                <div className="h-2 w-3/4 bg-muted-ash" />
              </div>
            </div>
          </div>
        </div>
        <div>
          <p className="font-terminal text-[12px] font-bold uppercase tracking-widest text-ghost-white">
            {title}
          </p>
          <p className="mt-6 text-[12px] leading-relaxed text-dim-gray">{description}</p>
        </div>
      </div>
    </div>
  )
}

function ActionLink({
  action,
}: {
  action: NonNullable<GuideStage['primaryAction']>
}) {
  if (action.external) {
    return (
      <a href={action.href} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
        <Button variant="primary" size="sm" className="w-full sm:w-auto">
          {action.label}
          <ExternalLink size={15} aria-hidden="true" />
        </Button>
      </a>
    )
  }

  return (
    <Link href={action.href} className="w-full sm:w-auto">
      <Button variant="primary" size="sm" className="w-full sm:w-auto">
        {action.label}
        <ArrowRight size={15} aria-hidden="true" />
      </Button>
    </Link>
  )
}
