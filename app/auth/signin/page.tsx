'use client'

import Link from 'next/link'
import { authClient } from '@/lib/authClient'
import { Button } from '@/components/ui/Button'

export default function SignInPage() {
  const { data: session, isPending } = authClient.useSession()

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/vault',
    })
  }

  if (isPending) {
    return (
      <main className="surface-page flex min-h-screen items-center justify-center">
        <p className="text-dim-gray text-sm font-terminal animate-pulse">cargando...</p>
      </main>
    )
  }

  if (session?.user) {
    // Already signed in
    return (
      <main className="surface-page flex min-h-screen items-center justify-center p-6">
        <div className="surface-card w-full max-w-sm p-8 text-center space-y-4">
          <p className="text-ghost-white font-terminal">
            Sesión activa como <span className="font-bold">{session.user.email}</span>
          </p>
          <Link href="/vault">
            <Button variant="primary" className="w-full">Ir al Vault</Button>
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="surface-page flex min-h-screen items-center justify-center p-6">
      <div className="surface-card w-full max-w-sm p-8 space-y-8">
        {/* Wordmark */}
        <div className="text-center">
          <h1 className="text-3xl font-black font-terminal tracking-widest text-ghost-white">
            PROMPTIER
          </h1>
          <p className="text-dim-gray text-sm mt-2 leading-relaxed">
            Tu vault local de prompts,<br />sincronizado cuando quieras.
          </p>
        </div>

        {/* Sign-in */}
        <Button
          variant="filled"
          className="w-full flex items-center justify-center gap-3"
          onClick={handleSignIn}
        >
          Continuar con Google
        </Button>

        <p className="text-xs text-dim-gray text-center leading-relaxed">
          Al continuar aceptas que tu nickname sea visible en prompts públicos.
          Tu email nunca se comparte.
        </p>
      </div>
    </main>
  )
}
