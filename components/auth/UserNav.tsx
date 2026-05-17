'use client'

// UserNav — shows sign-in button or user menu in the header
// Client Component — accesses auth session via Neon Auth React hooks
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/authClient'
import { Button } from '@/components/ui/Button'

type ProfileData = { nickname: string } | null
type UserNavVariant = 'inline' | 'mobile-menu'

interface UserNavProps {
  variant?: UserNavVariant
  className?: string
  onNavigate?: () => void
}

export function UserNav({ variant = 'inline', className = '', onNavigate }: UserNavProps) {
  const { data: session, isPending } = authClient.useSession()
  const [profile, setProfile] = useState<ProfileData | undefined>(undefined)

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }

    setProfile(undefined)
    fetch('/api/profile', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProfileData) => setProfile(data ?? null))
      .catch(() => setProfile(null))
  }, [session?.user])

  if (isPending) {
    return (
      <div className={['motion-skeleton h-7 w-20 rounded-[10px]', className].filter(Boolean).join(' ')} />
    )
  }

  if (!session?.user) {
    if (variant === 'mobile-menu') {
      return (
        <Link
          href="/getstarted"
          onClick={onNavigate}
          className={[
            'motion-press flex min-h-12 items-center justify-between rounded-(--radius-button) border border-muted-ash px-16 text-[13px] uppercase tracking-widest text-ghost-white hover:border-ghost-white hover:bg-steel-gray',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          Entrar
        </Link>
      )
    }

    return (
      <Link href="/getstarted" className={className}>
        <Button variant="ghost" size="sm">
          Entrar
        </Button>
      </Link>
    )
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = '/'
  }

  const displayName = profile?.nickname ?? (profile === undefined ? '...' : 'Cuenta')

  if (variant === 'mobile-menu') {
    return (
      <div className={['grid gap-8', className].filter(Boolean).join(' ')}>
        <Link
          href="/user"
          onClick={onNavigate}
          className="motion-press flex min-h-12 items-center justify-between rounded-(--radius-button) border border-muted-ash px-16 text-[13px] uppercase tracking-widest text-ghost-white hover:border-ghost-white hover:bg-steel-gray"
          title={profile?.nickname ?? 'Cuenta'}
        >
          <span className="text-dim-gray">Usuario</span>
          <span className="max-w-38 truncate text-right">{displayName}</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-between uppercase tracking-widest">
          Cerrar sesion
        </Button>
      </div>
    )
  }

  return (
    <div className={['flex items-center gap-2', className].filter(Boolean).join(' ')}>
      <Link
        href="/user"
        className="motion-press max-w-30 truncate font-terminal text-xs text-dim-gray hover:text-ghost-white"
        title={profile?.nickname ?? 'Cuenta'}
      >
        {displayName}
      </Link>
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        Salir
      </Button>
    </div>
  )
}
