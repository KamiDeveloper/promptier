import { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'dim' | 'online' | 'offline' | 'conflict' | 'pending'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClass: Record<BadgeVariant, string> = {
  default:  'border border-muted-ash text-ghost-white',
  dim:      'border border-transparent text-dim-gray',
  online:   'border border-muted-ash text-ghost-white',
  offline:  'border border-muted-ash text-dim-gray',
  conflict: 'border border-ghost-white text-ghost-white',
  pending:  'border border-muted-ash text-dim-gray motion-loading-dots',
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1',
        'rounded-sm',
        'px-6 py-5',
        'text-[11px] font-terminal uppercase tracking-widest',
        'transition-colors duration-200',
        variantClass[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </span>
  )
}
