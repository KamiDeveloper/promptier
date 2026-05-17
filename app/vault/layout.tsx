import { Header } from '@/components/layout/Header'
import { RequireAuthGate } from '@/components/auth/RequireAuthGate'
import { AuthNicknameGate } from '@/components/auth/AuthNicknameGate'

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <Header />
      <main
        className="flex-1 w-full mx-auto px-16 py-32"
        style={{ maxWidth: 'var(--page-max-width)' }}
      >
        <RequireAuthGate>
          <AuthNicknameGate>{children}</AuthNicknameGate>
        </RequireAuthGate>
      </main>
    </div>
  )
}
