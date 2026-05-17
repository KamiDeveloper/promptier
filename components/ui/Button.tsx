'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'

type ButtonVariant = 'ghost' | 'filled' | 'primary' | 'text' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  staticMotion?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  ghost:
    'bg-transparent text-ghost-white border border-muted-ash hover:border-ghost-white hover:bg-steel-gray',
  filled:
    'bg-steel-gray text-ghost-white border border-transparent hover:bg-muted-ash',
  primary:
    'bg-ghost-white text-[var(--color-midnight-oil)] border border-transparent hover:opacity-90 font-bold',
  text:
    'bg-transparent text-ghost-white border-none p-0 hover:text-dim-gray',
  danger:
    'bg-transparent text-ghost-white border border-muted-ash hover:border-ghost-white hover:bg-muted-ash',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-16 py-8 text-[13px]',
  md: 'px-[var(--spacing-26)] py-[var(--spacing-19)] text-[14px]',
  lg: 'px-32 py-[var(--spacing-26)] text-[16px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      loading = false,
      staticMotion = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isText = variant === 'text'

    return (
      <button
        ref={ref}
        disabled={(disabled || loading) || undefined}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        className={[
          'font-terminal',
          'cursor-pointer',
          'inline-flex min-h-10 items-center justify-center gap-2',
          'select-none whitespace-nowrap',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ghost-white',
          staticMotion ? '' : 'motion-press',
          isText ? '' : `rounded-(--radius-button)`,
          isText ? '' : sizeClasses[size],
          variantClasses[variant],
          'disabled:opacity-40 disabled:cursor-not-allowed',
          loading ? 'motion-busy' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {loading ? <span className="motion-loading-dots" aria-hidden="true">...</span> : children}
      </button>
    )
  },
)

Button.displayName = 'Button'
