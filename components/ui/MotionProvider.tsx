'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { MascotAnimation } from '@/components/mascot/MascotAnimation'

type ToastTone = 'default' | 'success' | 'warning' | 'danger'

type ToastInput = {
  title: string
  message?: string
  tone?: ToastTone
  durationMs?: number
}

type Toast = Required<Pick<ToastInput, 'title' | 'tone'>> & {
  id: string
  message?: string
  durationMs: number
}

type MotionContextValue = {
  reducedMotion: boolean
  notify: (toast: ToastInput) => string
  dismiss: (id: string) => void
}

const MotionContext = createContext<MotionContextValue | null>(null)

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const toneClass: Record<ToastTone, string> = {
  default: 'border-muted-ash bg-steel-gray text-ghost-white',
  success: 'border-ghost-white bg-steel-gray text-ghost-white',
  warning: 'border-dim-gray bg-steel-gray text-ghost-white',
  danger: 'border-ghost-white bg-midnight-oil text-ghost-white',
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback((input: ToastInput) => {
    const id = createId()
    const toast: Toast = {
      id,
      title: input.title,
      message: input.message,
      tone: input.tone ?? 'default',
      durationMs: input.durationMs ?? 3200,
    }

    setToasts((current) => [...current.slice(-3), toast])
    window.setTimeout(() => dismiss(id), toast.durationMs)
    return id
  }, [dismiss])

  const value = useMemo(
    () => ({ reducedMotion, notify, dismiss }),
    [dismiss, notify, reducedMotion],
  )

  return (
    <MotionContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-16 right-16 z-[120] flex w-[min(420px,calc(100vw-32px))] flex-col gap-8"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              'motion-toast pointer-events-auto rounded-(--radius-card) border px-16 py-12 font-terminal',
              toneClass[toast.tone],
            ].join(' ')}
            role={toast.tone === 'danger' ? 'alert' : 'status'}
          >
            <div className="flex items-start justify-between gap-16">
              {toast.tone === 'success' && (
                <MascotAnimation
                  variant="celebration"
                  size="xs"
                  crop="tight"
                  className="-ml-4 -mt-5"
                />
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-bold uppercase tracking-widest">{toast.title}</p>
                {toast.message && (
                  <p className="mt-4 text-[12px] leading-relaxed text-dim-gray">{toast.message}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Cerrar notificacion"
                onClick={() => dismiss(toast.id)}
                className="motion-press grid h-28 w-28 shrink-0 place-items-center rounded-(--radius-button) border border-muted-ash text-[16px] leading-none text-dim-gray transition-colors hover:border-ghost-white hover:text-ghost-white"
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </MotionContext.Provider>
  )
}

export function useMotionFeedback() {
  const context = useContext(MotionContext)
  if (!context) {
    throw new Error('useMotionFeedback must be used inside MotionProvider')
  }
  return context
}
