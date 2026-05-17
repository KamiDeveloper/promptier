'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/app/assets/logo'
import { authClient } from '@/lib/authClient'
import { getGetStartedPath } from '@/lib/auth/redirect'
import { AppModal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'

const NICKNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/

type ProfileData = { nickname: string } | null

type GetStartedClientProps = {
  nextPath: string
}

export function GetStartedClient({ nextPath }: GetStartedClientProps) {
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [profile, setProfile] = useState<ProfileData | undefined>(undefined)
  const [profileError, setProfileError] = useState('')
  const [nickname, setNickname] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [signInError, setSignInError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [isSavingNickname, startSavingNickname] = useTransition()
  const nicknameInputRef = useRef<HTMLInputElement>(null)

  const userId = session?.user?.id
  const userEmail = session?.user?.email

  useEffect(() => {
    if (sessionPending) return

    if (!userId) {
      setProfile(null)
      setProfileError('')
      return
    }

    let cancelled = false
    setProfile(undefined)
    setProfileError('')

    fetch('/api/profile', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`profile:${res.status}`)
        }
        return res.json() as Promise<ProfileData>
      })
      .then((data) => {
        if (cancelled) return
        setProfile(data?.nickname ? data : null)
      })
      .catch(() => {
        if (cancelled) return
        setProfile(undefined)
        setProfileError('No pude revisar tu NickName. Reintenta antes de entrar al vault.')
      })

    return () => {
      cancelled = true
    }
  }, [retryKey, sessionPending, userId])

  useEffect(() => {
    if (userId && profile?.nickname) {
      router.replace(nextPath)
    }
  }, [nextPath, profile?.nickname, router, userId])

  const handleSignIn = async () => {
    setSignInError('')
    setSigningIn(true)
    const callbackURL = getGetStartedPath(nextPath)

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL,
        errorCallbackURL: callbackURL,
        newUserCallbackURL: callbackURL,
      })
      setSigningIn(false)
    } catch {
      setSigningIn(false)
      setSignInError('Google no pudo iniciar. Revisa la conexion e intenta de nuevo.')
    }
  }

  const handleNicknameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNicknameError('')

    const trimmed = nickname.trim()
    if (!NICKNAME_RE.test(trimmed)) {
      setNicknameError('3-32 caracteres. Solo letras, numeros, guion y guion bajo.')
      return
    }

    startSavingNickname(async () => {
      try {
        const res = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: trimmed }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          setNicknameError(body.error ?? 'No pude guardar el NickName.')
          return
        }

        const data = await res.json() as { nickname: string }
        setProfile(data)
        router.replace(nextPath)
      } catch {
        setNicknameError('No pude guardar el NickName. Revisa la conexion.')
      }
    })
  }

  const needsNickname = !!userId && profile === null
  const checkingProfile = !!userId && profile === undefined && !profileError

  return (
    <main className="motion-page min-h-dvh bg-midnight-oil text-ghost-white">
      <section className="mx-auto grid min-h-dvh w-full max-w-(--page-max-width) grid-rows-[auto_1fr_auto] px-16 py-16 sm:px-32 sm:py-26 lg:px-[64px]">
        <header className="motion-scanline flex items-center justify-between gap-16 border-b border-muted-ash pb-16">
          <Link href="/" aria-label="Promptier home" className="motion-press text-ghost-white hover:text-dim-gray">
            <Logo variant="imagotype" className="h-8 w-auto sm:h-10" />
          </Link>
          <Link href="/public-prompts" className="motion-press text-[12px] uppercase tracking-widest text-dim-gray hover:text-ghost-white">
            Prompterest
          </Link>
        </header>

        <div className="grid items-center gap-16 py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.62fr)] lg:gap-32 lg:py-32">
          <section className="motion-panel grid min-h-[520px] min-w-0 gap-16 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,0.28fr)]">
            <div className="flex min-w-0 flex-col justify-between gap-32 rounded-(--radius-card) border border-muted-ash bg-steel-gray p-16 sm:p-32">
              <div className="space-y-16">
                <p className="text-[11px] uppercase tracking-widest text-dim-gray">Promptier access</p>
                <h1 className="max-w-4xl text-[clamp(36px,10vw,84px)] font-bold uppercase leading-none tracking-normal text-ghost-white">
                  Entra al vault.
                </h1>
              </div>

              <div className="grid gap-8 text-[12px] uppercase tracking-widest text-dim-gray sm:grid-cols-3">
                <Step label="Google" active={!userId} complete={!!userId} />
                <Step label="NickName" active={needsNickname || checkingProfile} complete={!!profile?.nickname} />
                <Step label="Vault" active={!!profile?.nickname} complete={false} />
              </div>
            </div>

            <div className="grid grid-rows-3 overflow-hidden rounded-(--radius-card) border border-muted-ash">
              {['local first', 'neon auth', 'pwa shell'].map((label, index) => (
                <div
                  key={label}
                  className={[
                    'flex items-end border-muted-ash p-16 text-[11px] uppercase tracking-widest',
                    index < 2 ? 'border-b' : '',
                    index === 1 ? 'bg-steel-gray text-ghost-white' : 'bg-midnight-oil text-dim-gray',
                  ].join(' ')}
                >
                  {label}
                </div>
              ))}
            </div>
          </section>

          <aside className="motion-panel rounded-(--radius-card) border border-muted-ash bg-steel-gray p-16 sm:p-26">
            <div className="space-y-32">
              <div className="space-y-8">
                <div className="flex items-start justify-between gap-12">
                  <Logo variant="isotype" className="h-14 w-auto text-ghost-white" decorative />
                  <MascotAnimation variant="greeting" size="md" crop="tight" />
                </div>
                <h2 className="text-[18px] font-bold uppercase tracking-widest text-ghost-white">
                  Get started
                </h2>
                <p className="text-[13px] leading-relaxed text-dim-gray">
                  Google crea la sesion. Promptier solo pide NickName si tu perfil todavia no lo tiene.
                </p>
              </div>

              {sessionPending ? (
                <StatusRow label="Verificando sesion" />
              ) : userId ? (
                <div className="space-y-16">
                  <div className="border-y border-muted-ash py-16">
                    <p className="text-[11px] uppercase tracking-widest text-dim-gray">Cuenta Google</p>
                    <p className="mt-6 truncate text-[13px] text-ghost-white">{userEmail}</p>
                  </div>

                  {checkingProfile && <StatusRow label="Revisando NickName" />}

                  {profileError && (
                    <div className="space-y-12">
                      <p className="text-[13px] leading-relaxed text-ghost-white">{profileError}</p>
                      <Button type="button" variant="ghost" className="w-full justify-between" onClick={() => setRetryKey((key) => key + 1)}>
                        Reintentar
                        <ArrowRight size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  )}

                  {needsNickname && (
                    <p className="text-[13px] leading-relaxed text-dim-gray">
                      Falta un NickName para completar la entrada.
                    </p>
                  )}

                  {profile?.nickname && <StatusRow label="Abriendo vault" />}
                </div>
              ) : (
                <div className="space-y-16">
                  <Button
                    type="button"
                    variant="primary"
                    className="min-h-14 w-full justify-between"
                    onClick={handleSignIn}
                    loading={signingIn}
                  >
                    Continuar con Google
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                  {signInError && (
                    <p className="text-[13px] leading-relaxed text-ghost-white" role="alert">
                      {signInError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-8 border-t border-muted-ash pt-16 text-[11px] uppercase tracking-widest text-dim-gray">
          <span>Auth proxy / Google OAuth / NickName gate</span>
          <span>Destino: vault</span>
        </footer>
      </section>

      <AppModal
        open={needsNickname}
        onOpenChange={() => undefined}
        title="Elige tu NickName"
        eyebrow="Ultimo paso"
        description="Solo el NickName aparece en prompts publicos. Tu email no se comparte."
        size="sm"
        dismissible={false}
        initialFocusRef={nicknameInputRef}
        footer={(
          <Button
            type="submit"
            form="getstarted-nickname-form"
            variant="primary"
            size="sm"
            loading={isSavingNickname}
          >
            Guardar y entrar
          </Button>
        )}
      >
        <form id="getstarted-nickname-form" onSubmit={handleNicknameSubmit} className="space-y-16">
          <Input
            ref={nicknameInputRef}
            label="NickName"
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value)
              if (nicknameError) setNicknameError('')
            }}
            placeholder="prompt_bro_42"
            error={nicknameError}
            maxLength={32}
            autoCapitalize="none"
            autoComplete="nickname"
          />
          <p className="text-[12px] leading-relaxed text-dim-gray">
            Usa 3-32 caracteres: letras, numeros, guion o guion bajo.
          </p>
        </form>
      </AppModal>
    </main>
  )
}

function Step({
  label,
  active,
  complete,
}: {
  label: string
  active: boolean
  complete: boolean
}) {
  return (
    <div
      className={[
        'flex min-h-12 items-center justify-between rounded-(--radius-button) border px-12',
        active || complete ? 'border-ghost-white text-ghost-white' : 'border-muted-ash text-dim-gray',
      ].join(' ')}
    >
      <span>{label}</span>
      {complete ? <Check size={14} aria-hidden="true" /> : <span aria-hidden="true">/</span>}
    </div>
  )
}

function StatusRow({ label }: { label: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between rounded-(--radius-button) border border-muted-ash bg-midnight-oil px-12 text-[12px] uppercase tracking-widest text-dim-gray">
      <span>{label}</span>
      <MascotAnimation variant="loading" size="xs" crop="tight" />
    </div>
  )
}
