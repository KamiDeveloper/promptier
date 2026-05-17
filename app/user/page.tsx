import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { RequireAuthGate } from '@/components/auth/RequireAuthGate'
import { AuthNicknameGate } from '@/components/auth/AuthNicknameGate'
import { UserSettingsClient } from '@/app/user/UserSettingsClient'

export const metadata: Metadata = {
  title: 'Usuario',
  description: 'Configuracion de cuenta e IA para Promptier.',
}

export default function UserPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main
        className="mx-auto w-full flex-1 px-16 py-32"
        style={{ maxWidth: 'var(--page-max-width)' }}
      >
        <RequireAuthGate>
          <AuthNicknameGate>
            <UserSettingsClient />
          </AuthNicknameGate>
        </RequireAuthGate>
      </main>
    </div>
  )
}
