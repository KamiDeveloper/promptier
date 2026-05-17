import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { MotionProvider } from '@/components/ui/MotionProvider'
import { MascotPreloader } from '@/components/mascot/MascotAnimation'

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.startsWith('http')
      ? process.env.NEXT_PUBLIC_APP_URL
      : `https://${process.env.NEXT_PUBLIC_APP_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

const siteUrl = getSiteUrl()
const defaultDescription = 'Vault offline-first para crear, organizar, mejorar y compartir prompts de imagen.'
const ogImage = {
  url: '/og-image.webp',
  width: 1200,
  height: 630,
  alt: 'Promptier - vault offline-first para prompts de imagen',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'Promptier',
  title: {
    default: 'Promptier',
    template: '%s | Promptier',
  },
  description: defaultDescription,
  manifest: '/manifest.webmanifest',
  keywords: [
    'Promptier',
    'prompt vault',
    'prompts de imagen',
    'AI prompts',
    'Gemini',
    'Prompterest',
    'offline-first',
  ],
  creator: 'Promptier',
  publisher: 'Promptier',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Promptier',
    title: 'Promptier',
    description: defaultDescription,
    url: '/',
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Promptier',
    description: defaultDescription,
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Promptier',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-terminal surface-page min-h-dvh antialiased">
        <MotionProvider>
          <AuthProvider>
            {children}
            <MascotPreloader />
          </AuthProvider>
        </MotionProvider>
      </body>
    </html>
  )
}
