'use client'

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from 'react'

const baseInputClass = [
  'w-full',
  'bg-steel-gray',
  'text-ghost-white',
  'placeholder:text-dim-gray',
  'border border-muted-ash',
  'rounded-(--radius-input)',
  'px-16 py-8',
  'font-terminal text-[14px]',
  'focus:outline-none focus:border-ghost-white',
  'motion-press',
  'disabled:opacity-40 disabled:cursor-not-allowed',
].join(' ')

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

function fallbackId(label?: string) {
  return label?.toLowerCase().replace(/\s+/g, '-')
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? fallbackId(label) ?? generatedId
    const errorId = error ? `${inputId}-error` : undefined
    return (
      <div className="flex flex-col gap-6">
        {label && (
          <label htmlFor={inputId} className="text-[12px] text-dim-gray font-terminal uppercase tracking-widest">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={`${baseInputClass} ${error ? 'border-ghost-white bg-midnight-oil' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-[12px] text-ghost-white font-terminal" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? fallbackId(label) ?? generatedId
    const errorId = error ? `${inputId}-error` : undefined
    return (
      <div className="flex flex-col gap-6">
        {label && (
          <label htmlFor={inputId} className="text-[12px] text-dim-gray font-terminal uppercase tracking-widest">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={`${baseInputClass} resize-y min-h-30 leading-relaxed ${error ? 'border-ghost-white bg-midnight-oil' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-[12px] text-ghost-white font-terminal" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
