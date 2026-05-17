import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { GuideClient } from '@/app/guide/GuideClient'

export const metadata: Metadata = {
  title: 'Guia Gemini',
  description: 'Guia paso a paso para obtener una API key de Gemini Free Tier y usarla en Promptier.',
}

export default function GuidePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main
        className="mx-auto w-full flex-1 px-16 py-24 sm:px-32 lg:px-[64px] lg:py-32"
        style={{ maxWidth: 'var(--page-max-width)' }}
      >
        <GuideClient />
      </main>
    </div>
  )
}
