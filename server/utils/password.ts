import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scryptCallback)

const HASH_PREFIX = 'scrypt'
const DERIVED_KEY_LENGTH = 64

export const hashPassword = async (password: string): Promise<string> => {
  const normalized = String(password || '')
  if (!normalized || normalized.length < 8) {
    throw new Error('Password must have at least 8 characters')
  }

  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(normalized, salt, DERIVED_KEY_LENGTH)) as Buffer
  return `${HASH_PREFIX}$${salt}$${derived.toString('hex')}`
}

export const verifyPassword = async (
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> => {
  const normalized = String(password || '')
  if (!normalized) return false

  const providedHash = String(storedHash || '').trim()
  const storedHashIsValid = /^scrypt\$[\da-f]{32}\$[\da-f]{128}$/i.test(providedHash)
  // Unknown accounts still execute scrypt so login/link responses don't reveal
  // whether an e-mail or WhatsApp number exists through an obvious timing gap.
  const hash = storedHashIsValid
    ? providedHash
    : `${HASH_PREFIX}$${'00'.repeat(16)}$${'00'.repeat(DERIVED_KEY_LENGTH)}`

  const [prefix, salt, keyHex] = hash.split('$')
  if (prefix !== HASH_PREFIX || !salt || !keyHex) return false

  let expectedKey: Buffer
  try {
    expectedKey = Buffer.from(keyHex, 'hex')
  } catch {
    return false
  }
  if (!expectedKey.length) return false

  const derived = (await scryptAsync(normalized, salt, expectedKey.length)) as Buffer
  if (derived.length !== expectedKey.length) return false
  const matches = timingSafeEqual(derived, expectedKey)
  return storedHashIsValid && matches
}
