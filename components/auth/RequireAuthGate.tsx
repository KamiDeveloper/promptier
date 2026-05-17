'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/authClient'
import { getGetStartedPath } from '@/lib/auth/redirect'

type Props = {
  children: React.ReactNode
}

export function RequireAuthGate({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()
  const userId = session?.user?.id

  useEffect(() => {
    if (!isPending && !userId) {
      router.replace(getGetStartedPath(pathname))
    }
  }, [isPending, pathname, router, userId])

  if (isPending) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <p className="font-terminal text-[13px] text-dim-gray">verificando sesion...</p>
      </div>
    )
  }

  if (!userId) return null

  return <>{children}</>
}
