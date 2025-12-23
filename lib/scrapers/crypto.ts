/**
 * MC13: Criptografia de credenciais de scrapers
 * 
 * IMPORTANTE: Credenciais são criptografadas antes de salvar no banco
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Gera chave de criptografia baseada em workspace_id
 */
function deriveKey(workspaceId: string): Buffer {
  const masterKey = process.env.SCRAPER_ENCRYPTION_KEY || 'default-key-change-in-production'
  const salt = crypto
    .createHash('sha256')
    .update(workspaceId + masterKey)
    .digest()
    .slice(0, SALT_LENGTH)
  
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha512')
}

/**
 * Criptografa credenciais
 */
export function encryptCredentials(
  workspaceId: string,
  credentials: Record<string, any>
): string {
  const key = deriveKey(workspaceId)
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  const plaintext = JSON.stringify(credentials)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Retornar: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

/**
 * Descriptografa credenciais
 */
export function decryptCredentials(
  workspaceId: string,
  encrypted: string
): Record<string, any> {
  const key = deriveKey(workspaceId)
  
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Formato de credenciais criptografadas inválido')
  }
  
  const [ivHex, tagHex, encryptedHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return JSON.parse(decrypted)
}

