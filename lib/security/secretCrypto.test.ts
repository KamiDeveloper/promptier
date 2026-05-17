import { beforeEach, expect, mock, test } from 'bun:test'
import { randomBytes } from 'crypto'

mock.module('server-only', () => ({}))

beforeEach(() => {
  process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  process.env.BYOK_FINGERPRINT_KEY = randomBytes(32).toString('base64')
  process.env.BYOK_ENCRYPTION_KID = 'test-v1'
})

test('encrypts and decrypts a Gemini API key with matching AAD', () => {
  const {
    buildGeminiKeyAad,
    decryptSecret,
    encryptSecret,
  } = require('@/lib/security/secretCrypto') as typeof import('@/lib/security/secretCrypto')
  const secret = 'AIzaSyExampleTestKey123456789'
  const aad = buildGeminiKeyAad('user-a', 'test-v1')
  const encrypted = encryptSecret(secret, aad)

  expect(encrypted.encryptedKey).not.toContain(secret)
  expect(decryptSecret(encrypted, aad)).toBe(secret)
})

test('refuses to decrypt when the user-bound AAD changes', () => {
  const {
    buildGeminiKeyAad,
    decryptSecret,
    encryptSecret,
  } = require('@/lib/security/secretCrypto') as typeof import('@/lib/security/secretCrypto')
  const secret = 'AIzaSyExampleTestKey123456789'
  const encrypted = encryptSecret(secret, buildGeminiKeyAad('user-a', 'test-v1'))

  expect(() => decryptSecret(encrypted, buildGeminiKeyAad('user-b', 'test-v1'))).toThrow()
})

test('fingerprint is stable and preview does not expose the full key', () => {
  const {
    fingerprintSecret,
    previewSecret,
  } = require('@/lib/security/secretCrypto') as typeof import('@/lib/security/secretCrypto')
  const secret = 'AIzaSyExampleTestKey123456789'

  expect(fingerprintSecret(secret)).toBe(fingerprintSecret(secret))
  expect(fingerprintSecret(secret)).not.toContain(secret)
  expect(previewSecret(secret)).toBe('••••6789')
})
