export type ModelTarget = 'gemini' | 'chatgpt' | 'other'
export type KnownModelTarget = Exclude<ModelTarget, 'other'>

export const MODEL_TARGET_OPTIONS: Array<{
  target: KnownModelTarget
  provider: string
  modelName: string
  storedValue: string
}> = [
  {
    target: 'gemini',
    provider: 'Gemini',
    modelName: 'Nanobanana 2',
    storedValue: 'Gemini Nanobanana 2',
  },
  {
    target: 'chatgpt',
    provider: 'ChatGPT',
    modelName: 'Image 2',
    storedValue: 'ChatGPT GPT Image 2',
  },
]

const OPTION_BY_TARGET = Object.fromEntries(
  MODEL_TARGET_OPTIONS.map((option) => [option.target, option]),
) as Record<KnownModelTarget, typeof MODEL_TARGET_OPTIONS[number]>

function normalizeForDetection(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

export function inferModelTarget(value?: string | null): ModelTarget | null {
  const normalized = normalizeForDetection(value?.trim() ?? '')
  if (!normalized) return null
  if (
    normalized.includes('gemini') ||
    normalized.includes('nanobanana') ||
    normalized.includes('google')
  ) {
    return 'gemini'
  }
  if (
    normalized.includes('chatgpt') ||
    normalized.includes('gptimage') ||
    normalized.includes('openai') ||
    normalized.includes('dalle')
  ) {
    return 'chatgpt'
  }
  return 'other'
}

export function getKnownModelOption(target: KnownModelTarget) {
  return OPTION_BY_TARGET[target]
}

export function buildModelValue(target: ModelTarget | '', customModel: string) {
  if (!target) return ''
  if (target === 'other') return customModel.trim()
  return getKnownModelOption(target).storedValue
}

export function normalizeModelValue(value?: string | null) {
  const trimmed = value?.trim() ?? ''
  const target = inferModelTarget(trimmed)
  if (target === 'gemini' || target === 'chatgpt') {
    return getKnownModelOption(target).storedValue
  }
  return trimmed
}

export function getModelPillLabel(value?: string | null) {
  const trimmed = value?.trim() ?? ''
  const target = inferModelTarget(trimmed)
  if (target === 'gemini' || target === 'chatgpt') {
    return getKnownModelOption(target).modelName
  }
  return trimmed || 'Otro'
}
