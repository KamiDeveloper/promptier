import 'server-only'

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto'

const AES_ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12

type EncryptedSecret = {
  encryptedKey: string
  iv: string
  authTag: string
  encryptionKid: string
}

function getBase64Key(envName: string): Buffer {
  const raw = process.env[envName]
  if (!raw) {
    throw new Error(`${envName} is not set.`)
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error(`${envName} must be a base64-encoded 32-byte key.`)
  }
  return key
}

export function getCurrentEncryptionKid() {
  return process.env.BYOK_ENCRYPTION_KID?.trim() || 'v1'
}

export function buildGeminiKeyAad(authUserId: string, encryptionKid: string) {
  return `${authUserId}:gemini:${encryptionKid}`
}

export function encryptSecret(secret: string, aad: string, encryptionKid = getCurrentEncryptionKid()): EncryptedSecret {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(AES_ALGORITHM, getBase64Key('BYOK_ENCRYPTION_KEY'), iv)
  cipher.setAAD(Buffer.from(aad, 'utf8'))

  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encryptionKid,
  }
}

export function decryptSecret(input: Pick<EncryptedSecret, 'encryptedKey' | 'iv' | 'authTag'>, aad: string) {
  const decipher = createDecipheriv(
    AES_ALGORITHM,
    getBase64Key('BYOK_ENCRYPTION_KEY'),
    Buffer.from(input.iv, 'base64'),
  )
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(Buffer.from(input.authTag, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.encryptedKey, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

export function fingerprintSecret(secret: string) {
  return createHmac('sha256', getBase64Key('BYOK_FINGERPRINT_KEY'))
    .update(secret, 'utf8')
    .digest('hex')
}

export function previewSecret(secret: string) {
  return `••••${secret.slice(-4)}`
}
