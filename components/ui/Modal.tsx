'use client'

import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'
type ModalTone = 'default' | 'danger'

type AppModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  eyebrow?: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: ModalSize
  tone?: ModalTone
  dismissible?: boolean
  closeLabel?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  className?: string
  bodyClassName?: string
}

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function AppModal({
  open,
  onOpenChange,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = 'md',
  tone = 'default',
  dismissible = true,
  closeLabel = 'Cerrar',
  initialFocusRef,
  className = '',
  bodyClassName = '',
}: AppModalProps) {
  const [mounted, setMounted] = useState(false)
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>(focusableSelector) ??
        panelRef.current
      target?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [initialFocusRef, open])

  const requestClose = useCallback(() => {
    if (dismissible) onOpenChange(false)
  }, [dismissible, onOpenChange])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      requestClose()
      return
    }

    if (event.key !== 'Tab' || !panelRef.current) return
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => element.offsetParent !== null)
    if (focusable.length === 0) {
      event.preventDefault()
      panelRef.current.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="motion-modal-backdrop fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-midnight-oil/80 px-16 py-32 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={[
          'motion-modal-panel surface-card flex w-full flex-col rounded-(--radius-card) border bg-steel-gray text-ghost-white',
          tone === 'danger' ? 'border-dim-gray' : 'border-muted-ash',
          sizeClass[size],
          'max-h-[calc(100dvh-32px)] overflow-hidden sm:max-h-[calc(100dvh-64px)]',
          className,
        ].filter(Boolean).join(' ')}
      >
        <div className="flex shrink-0 items-start justify-between gap-16 border-b border-muted-ash p-16">
          <div className="min-w-0 space-y-5">
            {eyebrow && (
              <p className="font-terminal text-[11px] uppercase tracking-widest text-dim-gray">
                {eyebrow}
              </p>
            )}
            <h2 id={titleId} className="font-terminal text-[16px] font-bold uppercase tracking-widest">
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="text-[13px] leading-relaxed text-dim-gray">
                {description}
              </div>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={requestClose}
              aria-label={closeLabel}
              className="motion-press grid h-32 w-32 shrink-0 place-items-center rounded-(--radius-button) border border-muted-ash text-[18px] leading-none text-dim-gray hover:border-ghost-white hover:text-ghost-white"
            >
              x
            </button>
          )}
        </div>

        {children && (
          <div className={['min-h-0 flex-1 overflow-y-auto p-16', bodyClassName].filter(Boolean).join(' ')}>
            {children}
          </div>
        )}

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-8 border-t border-muted-ash p-16">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-8">{children}</div>
}

type ConfirmOptions = {
  title: string
  message?: ReactNode
  content?: ReactNode
  eyebrow?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ModalTone
  size?: ModalSize
}

type PromptOptions = {
  title: string
  label: string
  message?: ReactNode
  eyebrow?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  required?: boolean
  maxLength?: number
  validate?: (value: string) => string | null
}

type AlertOptions = {
  title: string
  message?: ReactNode
  eyebrow?: string
  confirmLabel?: string
  size?: ModalSize
  content?: ReactNode
}

type ModalRequest =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void }
  | { kind: 'alert'; options: AlertOptions; resolve: () => void }

export function useAppModal() {
  const [request, setRequest] = useState<ModalRequest | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => (
    new Promise<boolean>((resolve) => setRequest({ kind: 'confirm', options, resolve }))
  ), [])

  const prompt = useCallback((options: PromptOptions) => (
    new Promise<string | null>((resolve) => setRequest({ kind: 'prompt', options, resolve }))
  ), [])

  const alert = useCallback((options: AlertOptions) => (
    new Promise<void>((resolve) => setRequest({ kind: 'alert', options, resolve }))
  ), [])

  const modalNode = useMemo(() => {
    if (!request) return null

    if (request.kind === 'confirm') {
      return (
        <ConfirmRequestModal
          options={request.options}
          onCancel={() => {
            setRequest(null)
            request.resolve(false)
          }}
          onConfirm={() => {
            setRequest(null)
            request.resolve(true)
          }}
        />
      )
    }

    if (request.kind === 'prompt') {
      return (
        <PromptRequestModal
          options={request.options}
          onCancel={() => {
            setRequest(null)
            request.resolve(null)
          }}
          onConfirm={(value) => {
            setRequest(null)
            request.resolve(value)
          }}
        />
      )
    }

    return (
      <AlertRequestModal
        options={request.options}
        onClose={() => {
          setRequest(null)
          request.resolve()
        }}
      />
    )
  }, [request])

  return { alert, confirm, modalNode, prompt }
}

function ConfirmRequestModal({
  options,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AppModal
      open
      onOpenChange={(next) => { if (!next) onCancel() }}
      title={options.title}
      eyebrow={options.eyebrow}
      description={options.message}
      tone={options.tone}
      size={options.size ?? 'sm'}
      footer={(
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {options.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button type="button" variant={options.tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {options.confirmLabel ?? 'Confirmar'}
          </Button>
        </>
      )}
    >
      {options.content}
    </AppModal>
  )
}

function PromptRequestModal({
  options,
  onCancel,
  onConfirm,
}: {
  options: PromptOptions
  onCancel: () => void
  onConfirm: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(options.defaultValue ?? '')
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (options.required !== false && !trimmed) {
      setError('Este campo es requerido.')
      return
    }
    const validationError = options.validate?.(trimmed)
    if (validationError) {
      setError(validationError)
      return
    }
    onConfirm(trimmed)
  }

  return (
    <AppModal
      open
      onOpenChange={(next) => { if (!next) onCancel() }}
      title={options.title}
      eyebrow={options.eyebrow}
      description={options.message}
      size="sm"
      initialFocusRef={inputRef}
      footer={(
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {options.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button type="submit" form="app-modal-prompt-form" variant="primary" size="sm">
            {options.confirmLabel ?? 'Guardar'}
          </Button>
        </>
      )}
    >
      <form id="app-modal-prompt-form" onSubmit={submit} className="space-y-16">
        <Input
          ref={inputRef}
          label={options.label}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            if (error) setError('')
          }}
          placeholder={options.placeholder}
          maxLength={options.maxLength}
          error={error}
        />
      </form>
    </AppModal>
  )
}

function AlertRequestModal({
  options,
  onClose,
}: {
  options: AlertOptions
  onClose: () => void
}) {
  return (
    <AppModal
      open
      onOpenChange={(next) => { if (!next) onClose() }}
      title={options.title}
      eyebrow={options.eyebrow}
      description={options.message}
      size={options.size ?? 'md'}
      footer={(
        <Button type="button" variant="primary" size="sm" onClick={onClose}>
          {options.confirmLabel ?? 'Entendido'}
        </Button>
      )}
    >
      {options.content}
    </AppModal>
  )
}
