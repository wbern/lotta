import { describe, expect, it } from 'vitest'
import { decryptData, encryptData, isEncryptedBackup } from './backup-encryption'

describe('backup encryption', () => {
  it('encrypts and decrypts data with a password', async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const password = 'test-password'

    const encrypted = await encryptData(original, password)
    expect(encrypted).toBeInstanceOf(Uint8Array)
    expect(encrypted.length).toBeGreaterThan(original.length)

    const decrypted = await decryptData(encrypted, password)
    expect(Array.from(decrypted)).toEqual(Array.from(original))
  })

  it('fails to decrypt with wrong password', async () => {
    const original = new Uint8Array([10, 20, 30])
    const encrypted = await encryptData(original, 'correct-password')

    await expect(decryptData(encrypted, 'wrong-password')).rejects.toThrow()
  })

  it('detects encrypted data vs plain SQLite vs unknown', async () => {
    const sqliteHeader = new Uint8Array([
      0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33,
      0x00,
    ])
    expect(isEncryptedBackup(sqliteHeader)).toBe(false)

    const encrypted = await encryptData(sqliteHeader, 'password')
    expect(isEncryptedBackup(encrypted)).toBe(true)

    const randomJunk = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    expect(isEncryptedBackup(randomJunk)).toBe(false)
  })

  it('encrypted output starts with magic prefix', async () => {
    const data = new Uint8Array([1, 2, 3])
    const encrypted = await encryptData(data, 'pw')
    const prefix = new TextDecoder().decode(encrypted.slice(0, 9))
    expect(prefix).toBe('LOTTA_ENC')
  })
})
