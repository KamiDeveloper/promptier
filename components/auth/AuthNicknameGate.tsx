'use client'

import { useEffect, useState, useTransition } from 'react'
import { authClient } from '@/lib/authClient'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useMotionFeedback } from '@/components/ui/MotionProvider'

const NICKNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/

type ProfileData = { nickname: string } | null

type Props = {
  children: React.ReactNode
}

export function AuthNicknameGate({ children }: Props) {
  const { data: session } = authClient.useSession()
  const [profile, setProfile] = useState<ProfileData | undefined>(undefined)
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const feedback = useMotionFeedback()

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }

    setProfile(undefined)
    fetch('/api/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { nickname: string } | null) => setProfile(data ?? null))
      .catch(() => setProfile(null))
  }, [session?.user])

  if (!session?.user || profile === undefined) return <>{children}</>
  if (profile !== null) return <>{children}</>

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = nickname.trim()
    if (!NICKNAME_RE.test(trimmed)) {
      setError('3-32 caracteres. Solo letras, numeros, guion y guion bajo.')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmed }),
      })
      if (res.ok) {
        const data = await res.json() as { nickname: string }
        setProfile(data)
        feedback.notify({ title: 'Nickname guardado', message: data.nickname, tone: 'success' })
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? 'Error al guardar el nickname.')
      }
    })
  }

  return (
    <div className="surface-page motion-page flex min-h-screen items-center justify-center p-6">
      <div className="surface-card motion-panel w-full max-w-sm space-y-6 rounded-(--radius-card) border border-muted-ash p-8">
        <div className="space-y-1">
          <h1 className="font-terminal text-xl font-bold tracking-wide text-ghost-white">
            ELIGE UN NICKNAME
          </h1>
          <p className="text-sm leading-relaxed text-dim-gray">
            Requerido para sincronizar y publicar prompts. Solo tu nickname sera visible
            publicamente, nunca tu email ni nombre real.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isPending}>
          <Input
            label="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="mi_nickname_42"
            autoFocus
            error={error}
            maxLength={32}
          />
          <Button type="submit" variant="primary" className="w-full" loading={isPending}>
            Continuar
          </Button>
        </form>

        <p className="text-xs text-dim-gray">
          Formato: 3-32 caracteres alfanumericos, <code>_</code> o <code>-</code>
        </p>
      </div>
    </div>
  )
}
