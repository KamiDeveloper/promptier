// 'use client' — Dexie runs only in the browser
// This module must never be imported in Server Components or API routes.
import Dexie, { type EntityTable } from 'dexie'

import type {
  LocalPrompt,
  LocalPromptImage,
  LocalCollection,
  LocalTemplate,
  LocalPromptVersion,
  LocalCopyHistory,
  LocalSyncOutboxItem,
  LocalPublicPromptCache,
  LocalUserSettings,
} from './schema'

class PromptierDB extends Dexie {
  prompts!:          EntityTable<LocalPrompt,           'id'>
  promptImages!:     EntityTable<LocalPromptImage,      'id'>
  collections!:      EntityTable<LocalCollection,       'id'>
  templates!:        EntityTable<LocalTemplate,         'id'>
  promptVersions!:   EntityTable<LocalPromptVersion,    'id'>
  copyHistory!:      EntityTable<LocalCopyHistory,      'id'>
  syncOutbox!:       EntityTable<LocalSyncOutboxItem,   'id'>
  publicPromptCache!:EntityTable<LocalPublicPromptCache,'id'>
  userSettings!:     EntityTable<LocalUserSettings,     'id'>

  constructor() {
    super('promptier')

    this.version(1).stores({
      // Primary key is ++id; indexed fields follow
      prompts: [
        '++id',
        '&localId',           // unique
        'remoteId',
        'collectionId',
        'syncStatus',
        'isFavorite',
        'type',
        'model',
        'orderIndex',
        '*tags',              // multi-entry index for array
        'updatedAt',
        'deletedAt',
        'lastCopiedAt',
      ].join(', '),

      promptImages: [
        '++id',
        '&localId',
        'promptLocalId',
        'sha256',
      ].join(', '),

      collections: [
        '++id',
        '&localId',
        'remoteId',
        'parentId',
        'syncStatus',
      ].join(', '),

      templates: [
        '++id',
        '&localId',
        'remoteId',
        'syncStatus',
        '*tags',
      ].join(', '),

      promptVersions: [
        '++id',
        'promptLocalId',
        'savedAt',
      ].join(', '),

      copyHistory: [
        '++id',
        'promptLocalId',
        'copiedAt',
      ].join(', '),

      syncOutbox: [
        '++id',
        '&operationId',
        'entityType',
        'entityLocalId',
        'status',
        'createdAt',
      ].join(', '),

      publicPromptCache: [
        '++id',
        '&remoteId',
        'cursorValue',
        'cachedAt',
        'publishedAt',
      ].join(', '),

      userSettings: [
        '++id',
        '&key',
      ].join(', '),
    })

    this.version(2).stores({
      prompts: [
        '++id',
        '&localId',
        'remoteId',
        'collectionId',
        'syncStatus',
        'isFavorite',
        'type',
        'model',
        'orderIndex',
        '*tags',
        'updatedAt',
        'deletedAt',
        'lastCopiedAt',
      ].join(', '),

      promptImages: [
        '++id',
        '&localId',
        'promptLocalId',
        'sha256',
        'createdAt',
      ].join(', '),

      collections: [
        '++id',
        '&localId',
        'remoteId',
        'name',
        'parentId',
        'syncStatus',
      ].join(', '),

      templates: [
        '++id',
        '&localId',
        'remoteId',
        'name',
        'syncStatus',
        '*tags',
      ].join(', '),

      promptVersions: [
        '++id',
        'promptLocalId',
        'savedAt',
      ].join(', '),

      copyHistory: [
        '++id',
        'promptLocalId',
        'copiedAt',
      ].join(', '),

      syncOutbox: [
        '++id',
        '&operationId',
        'entityType',
        'entityLocalId',
        'status',
        'createdAt',
      ].join(', '),

      publicPromptCache: [
        '++id',
        '&remoteId',
        'cursorValue',
        'cachedAt',
        'publishedAt',
      ].join(', '),

      userSettings: [
        '++id',
        '&key',
      ].join(', '),
    })
  }
}

// Singleton — instantiated lazily on first import in client context
let _db: PromptierDB | null = null

export function getDb(): PromptierDB {
  if (typeof window === 'undefined') {
    throw new Error('getDb() must only be called in browser context (Client Components).')
  }
  if (!_db) {
    _db = new PromptierDB()
  }
  return _db
}

// Named export for convenience in Client Components
export { PromptierDB }
