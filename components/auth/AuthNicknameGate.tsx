'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/authClient'
import { getGetStartedPath } from '@/lib/auth/redirect'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'

type ProfileData = { nickname: string } | null

type Props = {
  children: React.ReactNode
}

export function AuthNicknameGate({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const [profile, setProfile] = useState<ProfileData | undefined>(undefined)
  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }

    setProfile(undefined)
    fetch('/api/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { nickname: string } | null) => setProfile(data ?? null))
      .catch(() => setProfile(null))
  }, [userId])

  useEffect(() => {
    if (userId && profile === null) {
      router.replace(getGetStartedPath(pathname))
    }
  }, [pathname, profile, router, userId])

  if (!userId || profile === null) return null
  if (profile === undefined) {
    return (
      <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-12">
        <MascotAnimation variant="loading" size="md" crop="tight" />
        <p className="font-terminal text-[13px] text-dim-gray">verificando NickName...</p>
      </div>
    )
  }

  return <>{children}</>
}
