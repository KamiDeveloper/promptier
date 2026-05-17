import { z } from 'zod'

// ─── Zod schemas for AI-generated data ────────────────────────────────────
// Spec: AI outputs shall be structured and validated (ai-gemini spec)
// NEVER persist data that fails these schemas.

export const AiSuggestionsSchema = z.object({
  title:       z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  tags:        z.array(z.string().min(1).max(40)).max(10),
  type:        z.enum(['image_generation', 'image_editing', 'other']),
  model:       z.string().max(80).optional(),
})

export type AiSuggestions = z.infer<typeof AiSuggestionsSchema>

export const AiVariationsSchema = z.object({
  // Exactly 3 variations — spec: "implement exactly 3 quick variations"
  variations: z.array(z.string().min(1)).length(3),
})

export type AiVariations = z.infer<typeof AiVariationsSchema>

export const AiMagicTouchSchema = z.object({
  improvedContent: z.string().min(1),
  changesSummary:  z.string().max(300).optional(),
})

export type AiMagicTouch = z.infer<typeof AiMagicTouchSchema>

export const AiQualityScoreSchema = z.object({
  score:      z.number().int().min(0).max(100),
  rationale:  z.string().max(500),
})

export type AiQualityScore = z.infer<typeof AiQualityScoreSchema>

export const AiScreenshotExtractionSchema = z.object({
  extractedPrompt: z.string().min(1),
  title:           z.string().min(1).max(120),
  description:     z.string().max(280).optional().default(''),
  detectedFormat:  z.enum(['text', 'json', 'markdown']).optional(),
  sourceKind:      z.enum(['screenshot_text', 'generated_image', 'mixed', 'unknown']).optional().default('unknown'),
  shouldSaveSourceImage: z.boolean().optional().default(false),
  tags:            z.array(z.string()).max(10),
  type:            z.enum(['image_generation', 'image_editing', 'other']),
  model:           z.string().max(80).optional(),
  confidence:      z.number().min(0).max(1).optional().default(0.8),
  warnings:        z.array(z.string()).max(5).optional().default([]),
})

export type AiScreenshotExtraction = z.infer<typeof AiScreenshotExtractionSchema>

export const AiModelAdaptationSchema = z.object({
  adaptedContent: z.string().min(1),
  targetModel: z.string().min(1).max(80),
  changesSummary: z.string().max(500),
  warnings: z.array(z.string()).max(5).default([]),
})

export type AiModelAdaptation = z.infer<typeof AiModelAdaptationSchema>

export const AiPromptTranslationSchema = z.object({
  translatedContent: z.string().min(1),
  detectedSourceLanguage: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
  warnings: z.array(z.string()).max(5).default([]),
})

export type AiPromptTranslation = z.infer<typeof AiPromptTranslationSchema>
