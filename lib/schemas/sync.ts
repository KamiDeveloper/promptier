import { z } from 'zod'

// ─── Sync payload schemas ─────────────────────────────────────────────────

export const SyncPushItemSchema = z.object({
  operationId:  z.string().uuid(),
  entityType:   z.enum(['prompt', 'collection', 'template']),
  entityLocalId:z.string(),
  operation:    z.enum(['upsert', 'delete']),
  payload:      z.union([
    z.record(z.unknown()),
    z.string().transform((value, ctx) => {
      try {
        return JSON.parse(value) as Record<string, unknown>
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Payload JSON invalido' })
        return z.NEVER
      }
    }),
  ]),
})

export const SyncPushRequestSchema = z.object({
  operations: z.array(SyncPushItemSchema).max(100),
})

export const SyncImagePushItemSchema = z.discriminatedUnion('operation', [
  z.object({
    localId: z.string().min(1),
    promptLocalId: z.string().min(1),
    operation: z.literal('upsert'),
    dataUrl: z.string().startsWith('data:image/').max(7_000_000),
    sha256: z.string().min(16).max(128).optional(),
    mimeType: z.string().min(1).max(80),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }).strict(),
  z.object({
    localId: z.string().min(1),
    promptLocalId: z.string().min(1),
    operation: z.literal('delete'),
    updatedAt: z.string().optional(),
  }).strict(),
])

export const SyncImagePushRequestSchema = z.object({
  images: z.array(SyncImagePushItemSchema).min(1).max(10),
})

export const SyncPullRequestSchema = z.object({
  cursor: z.string().optional(), // ISO timestamp or null for full pull
})

export const SyncPushResponseItemSchema = z.object({
  operationId:   z.string().uuid(),
  entityLocalId: z.string(),
  remoteId:      z.string().optional(),
  remoteVersion: z.number().int().optional(),
  conflict:      z.boolean().optional(),
  error:         z.string().optional(),
})

export const SyncPushResponseSchema = z.object({
  results:   z.array(SyncPushResponseItemSchema),
  newCursor: z.string(),
})

export type SyncPushRequest  = z.infer<typeof SyncPushRequestSchema>
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>
export type SyncPullRequest  = z.infer<typeof SyncPullRequestSchema>
export type SyncImagePushRequest = z.infer<typeof SyncImagePushRequestSchema>

// ─── Public feed schemas ───────────────────────────────────────────────────

export const PublicPromptSchema = z.object({
  id:                  z.string(),
  title:               z.string(),
  description:         z.string().optional().default(''),
  content:             z.string(),
  contentType:         z.enum(['text', 'json', 'markdown']),
  authorNickname:      z.string(), // ONLY NickName
  tags:                z.array(z.string()),
  type:                z.enum(['image_generation', 'image_editing', 'other']),
  model:               z.string().optional(),
  optimizedImageUrl:   z.string().optional(),
  ownedByViewer:       z.boolean().optional().default(false),
  publishedAt:         z.string(), // ISO
  cursorValue:         z.string(),
})

export const PublicFeedResponseSchema = z.object({
  prompts:   z.array(PublicPromptSchema),
  nextCursor:z.string().nullable(),
  hasMore:   z.boolean().optional(),
})

export type PublicPrompt        = z.infer<typeof PublicPromptSchema>
export type PublicFeedResponse  = z.infer<typeof PublicFeedResponseSchema>
