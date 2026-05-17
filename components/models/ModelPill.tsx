import { ModelLogo } from '@/app/assets/models-logos/ModelLogo'
import { getModelPillLabel, inferModelTarget } from '@/lib/models/modelTargets'

type ModelPillSize = 'xs' | 'sm'

const sizeClasses: Record<ModelPillSize, string> = {
  xs: 'gap-1 px-6 py-4 text-[9px] md:px-8 md:py-5 md:text-[11px]',
  sm: 'gap-1.5 px-8 py-5 text-[11px]',
}

const iconClasses: Record<ModelPillSize, string> = {
  xs: 'h-3.5 w-3.5 md:h-4 md:w-4',
  sm: 'h-4 w-4',
}

export function ModelPill({
  model,
  size = 'sm',
  className = '',
}: {
  model?: string | null
  size?: ModelPillSize
  className?: string
}) {
  const label = getModelPillLabel(model)
  const target = inferModelTarget(model)

  if (!model?.trim()) return null

  return (
    <span
      className={[
        'inline-flex max-w-full items-center rounded-(--radius-button) border border-muted-ash font-bold leading-none text-ghost-white',
        sizeClasses[size],
        className,
      ].join(' ')}
      title={model}
    >
      {target && target !== 'other' && (
        <ModelLogo target={target} className={`${iconClasses[size]} shrink-0 text-ghost-white`} />
      )}
      <span className="truncate">{label}</span>
    </span>
  )
}
