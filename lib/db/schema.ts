// ─── Dexie/IndexedDB schema types ─────────────────────────────────────────
// These are the local-first data models. IndexedDB is the source of truth.
// Remote IDs and syncStatus track the state of Neon sync.

export type ContentType = 'text' | 'json' | 'markdown'
export type PromptType  = 'image_generation' | 'image_editing' | 'other'
export type SyncStatus  = 'local_only' | 'pending_upload' | 'synced' | 'conflict' | 'pending_delete'

// ─── Prompt ───────────────────────────────────────────────────────────────
export interface LocalPrompt {
  id?:            number          // Dexie auto-increment PK
  localId:        string          // UUID, stable client identifier
  remoteId?:      string          // Neon DB id after first sync
  title:          string
  content:        string          // exact text, JSON, or Markdown — never mutated silently
  contentType:    ContentType
  description?:   string
  tags:           string[]
  type:           PromptType
  model?:         string          // target AI model e.g. "Midjourney", "DALL-E 3"
  isFavorite:     boolean
  collectionId?:  string          // references Collection.localId
  orderIndex?:    number
  syncStatus:     SyncStatus
  baseVersion:    number          // local version counter
  remoteVersion?: number          // last known server version
  copyCount:      number
  lastCopiedAt?:  Date
  qualityScore?:  number          // Gemini AI score 0–100
  aiTags?:        string[]        // Gemini suggested tags
  createdAt:      Date
  updatedAt:      Date
  deletedAt?:     Date            // soft delete
}

// ─── PromptImage ─────────────────────────────────────────────────────────
export interface LocalPromptImage {
  id?:            number
  localId:        string
  remoteId?:      string
  promptLocalId:  string
  originalBlob?:  Blob            // raw upload, local only; never uploaded or overwritten by sync
  optimizedBlob?: Blob            // 720p WebP 85%, local cache
  remoteUrl?:     string          // base64 data URL stored in Neon after sync
  sha256?:        string          // hash of optimized for deduplication
  mimeType:       string
  width?:         number
  height?:        number
  syncStatus:     SyncStatus
  createdAt:      Date
  updatedAt:      Date
  deletedAt?:     Date
}

// ─── Collection ──────────────────────────────────────────────────────────
export interface LocalCollection {
  id?:       number
  localId:   string
  remoteId?: string
  name:      string
  parentId?: string               // one level deep max (spec: search-organization)
  syncStatus: SyncStatus
  createdAt: Date
  updatedAt: Date
}

// ─── Template ─────────────────────────────────────────────────────────────
export interface LocalTemplate {
  id?:         number
  localId:     string
  remoteId?:   string
  name:        string
  content:     string
  contentType: ContentType
  tags:        string[]
  syncStatus:  SyncStatus
  createdAt:   Date
  updatedAt:   Date
}

// ─── PromptVersion ────────────────────────────────────────────────────────
// Max 5 per prompt. Oldest is deleted when a 6th is created.
export interface LocalPromptVersion {
  id?:           number
  promptLocalId: string
  content:       string
  title:         string
  versionLabel?: string
  savedAt:       Date
}

// ─── CopyHistory ─────────────────────────────────────────────────────────
export interface LocalCopyHistory {
  id?:           number
  promptLocalId: string
  copiedAt:      Date
}

// ─── SyncOutboxItem ───────────────────────────────────────────────────────
export type OutboxOperation    = 'upsert' | 'delete'
export type OutboxEntityType   = 'prompt' | 'collection' | 'template'
export type OutboxStatus       = 'pending' | 'processing' | 'failed' | 'done'

export interface LocalSyncOutboxItem {
  id?:             number
  operationId:     string          // UUID, idempotent key
  entityType:      OutboxEntityType
  entityLocalId:   string
  operation:       OutboxOperation
  payload:         string          // JSON.stringify of the entity snapshot
  createdAt:       Date
  attempts:        number
  lastAttemptAt?:  Date
  status:          OutboxStatus
  error?:          string
}

// ─── PublicPromptCache ────────────────────────────────────────────────────
export interface LocalPublicPromptCache {
  id?:             number
  remoteId:        string
  title:           string
  content:         string
  contentType:     ContentType
  authorNickname:  string          // ONLY NickName — no email, no auth id
  tags:            string[]
  type:            PromptType
  model?:          string
  optimizedImageUrl?: string
  cachedAt:        Date
  publishedAt:     Date
  cursorValue:     string          // ISO timestamp used for keyset pagination
}

// ─── UserSettings ─────────────────────────────────────────────────────────
export interface LocalUserSettings {
  id?:       number
  key:       string
  value:     string
  updatedAt: Date
}
