import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  interactive?: boolean
}

export function Card({ padded = true, interactive = false, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={[
        'rounded-(--radius-card)',
        'border border-muted-ash',
        'bg-steel-gray',
        'motion-card',
        padded ? 'p-16' : '',
        interactive
          ? 'cursor-pointer hover:border-dim-gray'
          : '',
        // spec: no box-shadow
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}
