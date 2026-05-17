'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Bookmark, Download, Sparkles, WifiOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/authClient'
import { getGetStartedPath } from '@/lib/auth/redirect'
import { Logo } from '@/app/assets/logo'
import { Button } from '@/components/ui/Button'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'

const promptLines = [
  '# EDITORIAL POSTER PROMPT',
  'REFERENCE_IMAGE: attached portrait',
  'SYMBOL_OR_LETTER: custom mark',
  'ASPECT_RATIO: 3:4',
  'MOOD: high contrast / cinematic',
  'OUTPUT: polished visual system',
]

const featureTiles = [
  { label: 'Vault', icon: Bookmark, text: 'Prompts privados, versionados y listos para copiar.' },
  { label: 'AI Assist', icon: Sparkles, text: 'Mejora, adapta, puntua y genera variantes.' },
  { label: 'Offline', icon: WifiOff, text: 'Trabajo local-first aunque la red falle.' },
]

type ProfileData = { nickname: string } | null
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function RootPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [profile, setProfile] = useState<ProfileData | undefined>(undefined)
  const [profileCheckFailed, setProfileCheckFailed] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [installState, setInstallState] = useState<'idle' | 'waiting' | 'dismissed'>('waiting')
  const userId = session?.user?.id

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

    if (isStandalone) {
      setInstalled(true)
      setInstallState('idle')
      return
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setInstallState('idle')
    }

    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      setInstallState('idle')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    if (isPending) return

    if (!userId) {
      setProfile(null)
      setProfileCheckFailed(false)
      return
    }

    let cancelled = false
    setProfile(undefined)
    setProfileCheckFailed(false)

    fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`profile:${res.status}`)
        }
        return res.json() as Promise<ProfileData>
      })
      .then((data) => {
        if (cancelled) return

        if (data?.nickname) {
          setProfile(data)
          return
        }

        setProfile(null)
        router.replace(getGetStartedPath('/vault'))
      })
      .catch(() => {
        if (cancelled) return
        setProfile(null)
        setProfileCheckFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [isPending, router, userId])

  const isCheckingAccess = isPending || (!!userId && profile === undefined && !profileCheckFailed)
  const installStatusText = installed
    ? 'Instalada en este dispositivo.'
    : installPrompt
      ? 'App local-first lista para instalar.'
      : installState === 'dismissed'
        ? 'Puedes volver a intentarlo desde el navegador.'
        : 'Disponible cuando el navegador habilite la instalacion.'

  async function handleInstall() {
    if (installed) return

    if (!installPrompt) {
      setInstallState('dismissed')
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    setInstallState(choice.outcome === 'accepted' ? 'idle' : 'dismissed')
  }

  return (
    <main className="motion-page min-h-dvh bg-midnight-oil text-ghost-white">
      <section className="mx-auto flex min-h-dvh w-full max-w-(--page-max-width) flex-col px-16 py-7 sm:px-32 sm:py-12 lg:px-[64px] lg:py-10">
        <header className="motion-scanline flex flex-wrap items-center justify-between gap-x-[24px] gap-y-16 border-b border-muted-ash pb-7 sm:flex-nowrap sm:pb-10 lg:pb-10">
          <Link href="/" aria-label="Promptier home" className="motion-press inline-flex items-center text-ghost-white hover:text-dim-gray">
            <Logo variant="imagotype" className="h-7.5 md:h-10" />
          </Link>
          <nav className="ml-auto flex min-w-0 items-center gap-[20px] text-[11px] uppercase tracking-widest text-dim-gray sm:gap-10 sm:text-[13px] lg:gap-[64px]">
            <Link href="/public-prompts" className="motion-press hover:text-ghost-white">Prompterest</Link>
          </nav>
        </header>

        <div className="grid flex-1 gap-10 py-10 lg:gap-12 lg:py-14 xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] xl:gap-16 xl:py-16 min-[1700px]:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <section className="grid min-w-0 gap-10 lg:gap-12 xl:grid-rows-[1fr_auto] xl:gap-16">
            <div className="motion-panel flex min-h-90 min-w-0 flex-col justify-between gap-18 rounded-(--radius-card) border border-muted-ash bg-steel-gray p-[24px] sm:min-h-105 sm:p-12 lg:p-[64px] xl:p-18 min-[1700px]">
              <div className="flex items-start justify-between gap-16">
                <div>
                <p className="mb-3 text-[11px] uppercase tracking-widest text-dim-gray sm:text-[12px]">099-grade prompt workspace</p>
                <div className='flex w-full md:w-auto gap-2'>
                  <MascotAnimation variant="greeting" size="sm" crop="tight" className="lg:hidden" />
                <Logo variant="logotype" className=" h-12 md:mt-20 text-ghost-white" />
                </div>
                </div>
              </div>

              <div className="max-w-xl">
                <h1 className="text-[clamp(34px,12vw,68px)] font-bold uppercase leading-none tracking-normal text-ghost-white xl:text-[clamp(54px,5vw,86px)] min-[1700px]:text-[clamp(56px,5vw,92px)]">
                  Prompts for Bros.
                </h1>
                <p className="mt-32 text-[13px] leading-relaxed text-dim-gray sm:mt-12 sm:text-[15px] xl:mt-20">
                  Organiza prompts, referencias y versiones en un vault local-first. Publica snapshots visuales en Prompterest cuando quieras compartir.
                </p>
              </div>
            </div>

            <div className="grid gap-16 sm:grid-cols-2">
              <Link href="/public-prompts">
                <Button variant="ghost" className="min-h-14 w-full justify-between">
                  Explorar Prompterest
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </Link>
              {isCheckingAccess ? (
                <div className="motion-skeleton h-14 rounded-(--radius-button)" aria-label="verificando sesion" />
              ) : userId && profile?.nickname ? (
                <Link href="/vault">
                  <Button variant="primary" className="min-h-14 w-full justify-between">
                    Entrar al vault
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </Link>
              ) : userId ? (
                <Link href={getGetStartedPath('/vault')}>
                  <Button variant="primary" className="min-h-14 w-full justify-between">
                    Completar NickName
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </Link>
              ) : (
                <Link href="/getstarted">
                  <Button variant="primary" className="min-h-14 w-full justify-between">
                    Continuar con Google
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </Link>
              )}
              <Button
                variant="primary"
                className="pwa-install-shiny min-h-14 w-full justify-between overflow-hidden sm:hidden"
                onClick={handleInstall}
                disabled={installed}
              >
                <span>{installed ? 'App instalada' : 'Instalar App'}</span>
                <Download size={16} aria-hidden="true" />
              </Button>
            </div>
          </section>

          <section className="grid min-w-0 gap-10 lg:gap-12 xl:grid-rows-[minmax(420px,1fr)_auto] xl:gap-16">
            <div className="motion-panel overflow-hidden rounded-(--radius-card) border border-muted-ash bg-steel-gray">
              <div className="grid h-full min-h-[unset] gap-0 lg:min-h-105 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="flex min-h-80 min-w-0 flex-col justify-between border-b border-muted-ash p-[24px] sm:min-h-90 sm:p-12 lg:min-h-0 lg:border-b-0 lg:border-r lg:p-14">
                  <div>
                    <p className="mb-8 text-[12px] uppercase tracking-widest text-dim-gray">Live prompt document</p>
                    <h2 className="text-[19px] font-bold uppercase tracking-widest sm:text-[22px]">Symbol Poster</h2>
                  </div>
                  <pre className="mt-32 overflow-x-auto whitespace-pre-wrap rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16 font-terminal text-[11px] leading-relaxed text-ghost-white sm:mt-12 sm:text-[13px]">
                    {promptLines.join('\n')}
                  </pre>
                </div>

                <div className="relative flex min-h-110 min-w-0 flex-col justify-between overflow-hidden p-[24px] sm:min-h-130 sm:p-12 lg:min-h-0 lg:p-14">
                  <div className="absolute inset-0 opacity-[0.08]" aria-hidden="true">
                    <div className="grid h-full grid-cols-6 gap-px">
                      {Array.from({ length: 36 }).map((_, index) => (
                        <div key={index} className="border border-ghost-white/20" />
                      ))}
                    </div>
                  </div>
                  <div className="relative flex items-center justify-between">
                    <p className="text-[12px] uppercase tracking-widest text-dim-gray">Reference cover</p>
                    <span className="rounded-sm border border-muted-ash px-6 py-5 text-[11px] uppercase tracking-widest text-dim-gray">3:4</span>
                  </div>
                  <div className="relative mx-auto my-32 aspect-3/4 w-[min(78%,300px)] rounded-(--radius-card) border border-muted-ash bg-midnight-oil p-16 sm:my-12 sm:w-[min(72%,340px)]">
                    <div className="h-full rounded-md border border-muted-ash bg-steel-gray p-16">
                      <div className="flex h-full flex-col justify-between">
                        <div className="text-[10px] uppercase tracking-widest text-dim-gray sm:text-[12px]">Promptier / 027</div>
                        <Logo variant="isotype" className="mx-auto h-16 w-auto text-ghost-white sm:h-20" decorative />
                        <div className="space-y-3">
                          <div className="h-3 w-3/4 bg-muted-ash" />
                          <div className="h-3 w-1/2 bg-muted-ash" />
                          <div className="h-3 w-2/3 bg-muted-ash" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="relative grid grid-cols-3 gap-[8px]">
                    {['Magic', 'Score', 'Publish'].map((label) => (
                      <div key={label} className="min-w-0 rounded-(--radius-button) border border-muted-ash px-1 py-[8px] text-center text-[10px] uppercase tracking-widest text-dim-gray sm:px-2.5 sm:text-[11px]">
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-16 sm:grid-cols-2 xl:grid-cols-4">
              <InstallPromptTile
                installed={installed}
                statusText={installStatusText}
                onInstall={handleInstall}
              />
              {featureTiles.slice().map(({ label, icon: Icon, text }) => (
                <article key={label} className="motion-card min-h-33 rounded-(--radius-card) border border-muted-ash bg-steel-gray p-16">
                  <div className="mb-16 flex h-10 w-10 items-center justify-center rounded-(--radius-button) border border-muted-ash">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <h3 className="text-[13px] font-bold uppercase tracking-widest">{label}</h3>
                  <p className="mt-8 text-[12px] leading-relaxed text-dim-gray">{text}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-muted-ash sm:pt-10 text-[11px] uppercase tracking-widest text-dim-gray md:pt-16 sm:text-[12px]">
          <span>Terminal aesthetic / Local-first / Neon sync</span>
          <span>Prompterest public feed</span>
        </footer>
      </section>
    </main>
  )
}

function InstallPromptTile({
  installed,
  statusText,
  onInstall,
}: {
  installed: boolean
  statusText: string
  onInstall: () => void
}) {
  return (
    <article className="motion-card relative min-h-33 overflow-hidden rounded-(--radius-card) border border-ghost-white/40 bg-steel-gray p-16">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-ghost-white),transparent)] opacity-50" aria-hidden="true" />
      <div className="mb-2 flex items-start gap-8">
        <MascotAnimation variant="flexing" size="xs" crop="tight" />
        <h3 className="text-[13px] font-bold uppercase tracking-widest">Instalar Promptier</h3>
      </div>
      <p className="mt-8 min-h-8.5 text-[12px] leading-relaxed text-dim-gray">{statusText}</p>
      <Button
        variant="primary"
        size="sm"
        className="pwa-install-shiny mt-2 w-full justify-between overflow-hidden"
        onClick={onInstall}
        disabled={installed}
      >
        <span>{installed ? 'Instalado' : 'Instalar App'}</span>
        <Download size={15} aria-hidden="true" />
      </Button>
    </article>
  )
}
