const ENCRYPTED_MAGIC = 'LOTTA_ENC'
const ENCRYPTED_MAGIC_BYTES = new TextEncoder().encode(ENCRYPTED_MAGIC)
const SALT_LENGTH = 16
const IV_LENGTH = 12
const ITERATIONS = 100_000

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptData(data: Uint8Array, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(password, salt)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource,
  )
  const prefix = ENCRYPTED_MAGIC_BYTES
  const result = new Uint8Array(prefix.length + salt.length + iv.length + ciphertext.byteLength)
  result.set(prefix, 0)
  result.set(salt, prefix.length)
  result.set(iv, prefix.length + salt.length)
  result.set(new Uint8Array(ciphertext), prefix.length + salt.length + iv.length)
  return result
}

export function isEncryptedBackup(data: Uint8Array): boolean {
  const header = new TextDecoder().decode(data.slice(0, ENCRYPTED_MAGIC.length))
  return header === ENCRYPTED_MAGIC
}

export async function decryptData(data: Uint8Array, password: string): Promise<Uint8Array> {
  const offset = ENCRYPTED_MAGIC_BYTES.length
  const salt = data.slice(offset, offset + SALT_LENGTH)
  const iv = data.slice(offset + SALT_LENGTH, offset + SALT_LENGTH + IV_LENGTH)
  const ciphertext = data.slice(offset + SALT_LENGTH + IV_LENGTH)
  const key = await deriveKey(password, salt)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  )
  return new Uint8Array(plaintext)
}
