'use client'

import { useEffect, useState } from 'react'

export type MascotVariant = 'greeting' | 'celebration' | 'loading' | 'flexing'
export type MascotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export const mascotAnimationSources: Record<MascotVariant, string> = {
  greeting: '/animations/greatings.webm',
  celebration: '/animations/happyness.webm',
  loading: '/animations/loading.webm',
  flexing: '/animations/flexing.webm',
}

type MascotAnimationProps = {
  variant: MascotVariant
  size?: MascotSize
  crop?: 'tight' | 'balanced' | 'loose'
  className?: string
  decorative?: boolean
  label?: string
}

type NavigatorConnection = {
  saveData?: boolean
}

const sizeClass: Record<MascotSize, string> = {
  xs: 'h-7 w-7',
  sm: 'h-12.5 w-12.5',
  md: 'h-20.5 w-20.5',
  lg: 'h-32.5 w-32.5',
  xl: 'h-48 w-48',
}

const cropScale: Record<NonNullable<MascotAnimationProps['crop']>, string> = {
  tight: 'scale-[1.72]',
  balanced: 'scale-[1.48]',
  loose: 'scale-[1.26]',
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return reducedMotion
}

export function MascotAnimation({
  variant,
  size = 'md',
  crop = 'balanced',
  className = '',
  decorative = true,
  label,
}: MascotAnimationProps) {
  const reducedMotion = usePrefersReducedMotion()

  if (reducedMotion) return null

  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={!decorative ? label : undefined}
      role={!decorative ? 'img' : undefined}
      className={[
        'pointer-events-none relative inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-(--radius-card)',
        sizeClass[size],
        className,
      ].filter(Boolean).join(' ')}
      onContextMenu={(event) => event.preventDefault()}
    >
      <video
        key={variant}
        src={mascotAnimationSources[variant]}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        draggable={false}
        controls={false}
        className={[
          'pointer-events-none h-full w-full max-w-none object-cover opacity-90',
          cropScale[crop],
        ].join(' ')}
        ref={(node) => {
          if (!node) return
          node.disablePictureInPicture = true
          node.disableRemotePlayback = true
          node.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback')
        }}
      />
    </span>
  )
}

export function MascotPreloader() {
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const connection = (navigator as Navigator & { connection?: NavigatorConnection }).connection
    if (connection?.saveData) return

    const preload = () => {
      Object.values(mascotAnimationSources).forEach((source) => {
        void fetch(source, { cache: 'force-cache' }).catch(() => undefined)
      })
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(preload, { timeout: 2500 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = globalThis.setTimeout(preload, 1000)
    return () => globalThis.clearTimeout(timeoutId)
  }, [reducedMotion])

  return null
}
