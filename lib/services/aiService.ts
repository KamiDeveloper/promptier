import 'server-only'

// AI Service - SERVER ONLY.
// All Gemini calls go through this service. User BYOK secrets never leave the server.
import { GoogleGenAI, ThinkingLevel, HarmBlockThreshold, HarmCategory } from '@google/genai'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type {
  AiSuggestions,
  AiVariations,
  AiMagicTouch,
  AiQualityScore,
  AiScreenshotExtraction,
  AiModelAdaptation,
  AiPromptTranslation,
} from '@/lib/schemas/ai'
import {
  AiSuggestionsSchema,
  AiVariationsSchema,
  AiMagicTouchSchema,
  AiQualityScoreSchema,
  AiScreenshotExtractionSchema,
  AiModelAdaptationSchema,
  AiPromptTranslationSchema,
} from '@/lib/schemas/ai'
import { consumeSharedAiQuota, recordByokAiUsage } from '@/lib/services/aiUsageService'
import { AiServiceError } from '@/lib/services/aiErrors'
import {
  getGeminiKeyForUser,
  toSdkThinkingLevel,
  touchGeminiKeyUsed,
} from '@/lib/services/userAiKeyService'
import type { z } from 'zod'

const MODEL = 'gemini-3-flash-preview'

export type AiExecutionContext = {
  userId: string
}

type AiCredentialSource = 'byok' | 'shared'

type AiExecution = {
  ai: GoogleGenAI
  source: AiCredentialSource
  thinkingLevel: ThinkingLevel
}

function getSharedGeminiKey() {
  return process.env.GEMINI_SHARED_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || ''
}

async function resolveAiExecution(ctx: AiExecutionContext): Promise<AiExecution> {
  const byok = await getGeminiKeyForUser(ctx.userId)
  if (byok) {
    return {
      ai: new GoogleGenAI({ apiKey: byok.apiKey }),
      source: 'byok',
      thinkingLevel: toSdkThinkingLevel(byok.thinkingLevel),
    }
  }

  const sharedKey = getSharedGeminiKey()
  if (!sharedKey) {
    throw new AiServiceError(
      'AI_NOT_CONFIGURED',
      'AI no configurada. Agrega tu API key Gemini en /user o configura GEMINI_SHARED_API_KEY en el servidor.',
      503,
    )
  }

  await consumeSharedAiQuota(ctx.userId)

  return {
    ai: new GoogleGenAI({ apiKey: sharedKey }),
    source: 'shared',
    thinkingLevel: ThinkingLevel.LOW,
  }
}

async function recordSuccessfulAiUse(ctx: AiExecutionContext, execution: AiExecution) {
  if (execution.source === 'byok') {
    await Promise.all([
      touchGeminiKeyUsed(ctx.userId),
      recordByokAiUsage(ctx.userId),
    ])
  }
}

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
]

/**
 * Calls Gemini with a structured JSON prompt and validates the response with Zod.
 * Disables thought summaries so model thinking is never persisted.
 */
async function callGemini<T>(
  ctx: AiExecutionContext,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T> {
  const execution = await resolveAiExecution(ctx)
  const response = await execution.ai.models.generateContent({
    model: MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseJsonSchema: zodToJsonSchema(schema),
      thinkingConfig: {
        thinkingLevel: execution.thinkingLevel,
        includeThoughts: false,
      },
      safetySettings,
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini devolvio una respuesta vacia.')

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Respuesta de Gemini no es JSON valido: ${text.slice(0, 200)}`)
  }

  const result = schema.parse(parsed)
  await recordSuccessfulAiUse(ctx, execution)
  return result
}

export async function suggestMetadata(ctx: AiExecutionContext, content: string): Promise<AiSuggestions> {
  return callGemini<AiSuggestions>(
    ctx,
    'Eres un asistente experto en prompts de IA generativa de imagenes. ' +
    'Analiza el prompt proporcionado y devuelve SOLO un objeto JSON con los campos: ' +
    'title (string corto), description (string opcional), tags (array de hasta 10 strings), ' +
    'type ("image_generation" | "image_editing" | "other"), model (string opcional).',
    `Prompt:\n${content}`,
    AiSuggestionsSchema,
  )
}

export async function magicTouch(
  ctx: AiExecutionContext,
  content: string,
  editRequest: string,
  mode: 'edit' | 'retry' | 'iterate' = 'edit',
  previousResult?: string,
): Promise<AiMagicTouch> {
  const modeInstruction = {
    edit: 'Edita el prompt original segun la peticion del usuario.',
    retry: 'Genera una edicion alternativa usando la misma peticion. Evita repetir literalmente el resultado previo si se proporciona.',
    iterate: 'Usa el prompt entregado como la version actual ya editada y aplica otra pasada sutil con la misma peticion.',
  }[mode]

  return callGemini<AiMagicTouch>(
    ctx,
    'Eres un editor senior de prompts para IA generativa. Tu tarea es editar, no reemplazar. ' +
    'Aplica exactamente la peticion del usuario sobre el prompt dado, preservando intencion, sujeto, idioma, estructura, formato, variables, placeholders, restricciones, negativos y detalles utiles que no entren en conflicto. ' +
    'No rehagas completamente el prompt, no cambies el objetivo principal y no inventes requisitos nuevos salvo que el usuario lo pida explicitamente. ' +
    'Si el prompt es JSON, Markdown, lista, plantilla o contiene tokens entre llaves/corchetes, conserva un formato equivalente y valido. ' +
    'Prioriza claridad operativa, especificidad y control; elimina redundancias solo cuando mejoren el resultado. ' +
    'Devuelve SOLO un objeto JSON con: improvedContent (string), changesSummary (string opcional, max 300 chars).',
    [
      `Modo: ${modeInstruction}`,
      `Peticion de edicion del usuario:\n${editRequest}`,
      previousResult ? `Resultado previo a evitar como repeticion literal:\n${previousResult}` : '',
      `Prompt a editar:\n${content}`,
    ].filter(Boolean).join('\n\n'),
    AiMagicTouchSchema,
  )
}

export async function generateVariations(ctx: AiExecutionContext, content: string): Promise<AiVariations> {
  return callGemini<AiVariations>(
    ctx,
    'Eres un experto en prompt engineering para IA generativa de imagenes. ' +
    'Genera EXACTAMENTE 3 variaciones del prompt dado. Manten la intencion pero varia el estilo/tecnica. ' +
    'Devuelve SOLO un objeto JSON con: variations (array de EXACTAMENTE 3 strings).',
    `Prompt:\n${content}`,
    AiVariationsSchema,
  )
}

export async function scoreQuality(ctx: AiExecutionContext, content: string): Promise<AiQualityScore> {
  return callGemini<AiQualityScore>(
    ctx,
    'Eres un experto evaluador de prompts para IA generativa de imagenes. ' +
    'Evalua la calidad del prompt en una escala de 0 a 100. ' +
    'Devuelve SOLO un objeto JSON con: score (entero 0-100), rationale (string, max 500 chars).',
    `Prompt:\n${content}`,
    AiQualityScoreSchema,
  )
}

export async function adaptToModel(
  ctx: AiExecutionContext,
  content: string,
  targetModel: string,
): Promise<AiModelAdaptation> {
  return callGemini<AiModelAdaptation>(
    ctx,
    'Eres un experto en adaptar prompts entre modelos de generacion y edicion de imagen. ' +
    'Conserva la intencion original, ajusta sintaxis y devuelve SOLO JSON.',
    `Modelo destino: ${targetModel}\n\nPrompt:\n${content}`,
    AiModelAdaptationSchema,
  )
}

export async function translatePromptToSpanish(
  ctx: AiExecutionContext,
  content: string,
): Promise<AiPromptTranslation> {
  return callGemini<AiPromptTranslation>(
    ctx,
    'Eres un traductor senior especializado en prompts para generacion y edicion de imagenes. ' +
    'Traduce el prompt al espanol neutro, preservando exactamente la intencion visual, estructura, listas, JSON, Markdown, pesos, parametros, placeholders, negativos, nombres propios, nombres de modelos, tokens tecnicos y unidades. ' +
    'No mejores, no resumas, no cambies el objetivo y no agregues instrucciones nuevas. ' +
    'Si una palabra tecnica debe quedar en ingles para mantener compatibilidad con modelos de imagen, conservala. ' +
    'Devuelve SOLO JSON con translatedContent, detectedSourceLanguage, notes y warnings.',
    `Prompt original:\n${content}`,
    AiPromptTranslationSchema,
  )
}

export async function extractFromScreenshot(
  ctx: AiExecutionContext,
  base64DataUrl: string,
): Promise<AiScreenshotExtraction> {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('Formato de imagen invalido.')

  const [, mimeType, base64Data] = match
  const execution = await resolveAiExecution(ctx)

  const response = await execution.ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'Analiza la imagen como un experto senior en prompt engineering para generacion y edicion de imagenes. ' +
              'La imagen puede ser: (1) una captura donde aparece texto de un prompt, (2) una imagen ya generada que el usuario quiere replicar, o (3) una mezcla de UI, imagen y texto. ' +
              'Primero clasifica sourceKind: "screenshot_text" si el contenido principal es texto legible de prompt; "generated_image" si es principalmente una imagen visual sin prompt legible; "mixed" si hay texto util y referencia visual; "unknown" si no puedes inferirlo. ' +
              'Si sourceKind es "screenshot_text", transcribe el prompt visible con maxima fidelidad. Conserva idioma, saltos utiles, JSON, Markdown, pesos, parametros, negativos y placeholders. No inventes contenido invisible. ' +
              'Si sourceKind es "generated_image", crea un prompt de replicacion de alto nivel que describa sujeto, composicion, estilo, lente/camara, iluminacion, paleta, materiales, ambiente, calidad, restricciones y posibles negativos. No afirmes que era texto extraido. ' +
              'Si sourceKind es "mixed", combina transcripcion confiable con inferencia visual claramente operacional. ' +
              'Detecta formato como "json", "markdown" o "text". Sugiere titulo breve, descripcion breve, tipo, modelo recomendado y tags. ' +
              'warnings debe incluir problemas de legibilidad, texto cortado, baja confianza, elementos ambiguos o inferencias visuales importantes. ' +
              'shouldSaveSourceImage debe ser false cuando sourceKind sea "screenshot_text" y true cuando la imagen sea una referencia visual util ("generated_image" o "mixed"). ' +
              'Devuelve SOLO JSON valido con extractedPrompt, title, description, detectedFormat, sourceKind, shouldSaveSourceImage, tags, type, model, confidence y warnings.',
          },
          {
            inlineData: { mimeType, data: base64Data },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: zodToJsonSchema(AiScreenshotExtractionSchema),
      thinkingConfig: {
        thinkingLevel: execution.thinkingLevel,
        includeThoughts: false,
      },
      safetySettings,
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini devolvio una respuesta vacia.')

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Respuesta de Gemini no es JSON valido: ${text.slice(0, 200)}`)
  }

  const result = AiScreenshotExtractionSchema.parse(parsed)
  await recordSuccessfulAiUse(ctx, execution)
  return result
}
