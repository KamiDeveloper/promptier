'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/authClient'

type Props = {
  children: React.ReactNode
}

export function RequireAuthGate({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace(`/?next=${encodeURIComponent(pathname)}`)
    }
  }, [isPending, pathname, router, session?.user])

  if (isPending) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <p className="font-terminal text-[13px] text-dim-gray">verificando sesion...</p>
      </div>
    )
  }

  if (!session?.user) return null

  return <>{children}</>
}
