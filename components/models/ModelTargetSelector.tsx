'use client'

import { useState } from 'react'
import { ModelLogo } from '@/app/assets/models-logos/ModelLogo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  MODEL_TARGET_OPTIONS,
  buildModelValue,
  inferModelTarget,
  type ModelTarget,
} from '@/lib/models/modelTargets'

export function ModelTargetSelector({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const [pendingTarget, setPendingTarget] = useState<ModelTarget | ''>('')
  const inferredTarget = inferModelTarget(value)
  const selectedTarget = pendingTarget || inferredTarget || ''
  const customValue = selectedTarget === 'other' && inferredTarget === 'other' ? value : ''

  function selectTarget(target: ModelTarget) {
    setPendingTarget(target)
    onChange(buildModelValue(target, target === 'other' ? customValue : ''))
  }

  function updateCustomModel(nextValue: string) {
    setPendingTarget('other')
    onChange(nextValue)
  }

  return (
    <div className="flex flex-col gap-6">
      <span className="text-[12px] text-dim-gray font-terminal uppercase tracking-widest">
        Modelo objetivo
      </span>
      <div className="grid gap-8 sm:grid-cols-3">
        {MODEL_TARGET_OPTIONS.map((option) => (
          <button
            key={option.target}
            type="button"
            onClick={() => selectTarget(option.target)}
            aria-pressed={selectedTarget === option.target}
            className={[
              'motion-press flex min-h-14 items-center gap-8 rounded-(--radius-button) border px-12 py-8 text-left font-terminal',
              selectedTarget === option.target
                ? 'border-ghost-white bg-steel-gray text-ghost-white'
                : 'border-muted-ash bg-transparent text-dim-gray hover:border-ghost-white hover:text-ghost-white',
            ].join(' ')}
          >
            <ModelLogo target={option.target} className="h-4.5 w-4.5 shrink-0 text-ghost-white" />
            <span className="min-w-0">
              <span className="block text-[12px] font-bold uppercase tracking-widest">{option.provider}</span>
              <span className="block truncate text-[11px] text-dim-gray">{option.modelName}</span>
            </span>
          </button>
        ))}
        <Button
          type="button"
          variant={selectedTarget === 'other' ? 'filled' : 'ghost'}
          size="sm"
          onClick={() => selectTarget('other')}
          aria-pressed={selectedTarget === 'other'}
          className="min-h-14 justify-start uppercase tracking-widest"
        >
          Otro
        </Button>
      </div>
      {selectedTarget === 'other' && (
        <Input
          value={customValue}
          onChange={(event) => updateCustomModel(event.target.value)}
          placeholder="Ej: Midjourney v6, FLUX, DALL-E 3"
          maxLength={80}
          error={error}
          aria-label="Nombre del modelo objetivo"
        />
      )}
      {error && selectedTarget !== 'other' && (
        <p className="text-[12px] text-ghost-white font-terminal" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}
