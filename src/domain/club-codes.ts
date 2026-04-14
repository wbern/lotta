const MAX_CLUBS = 30

export function codeLength(clubCount: number): number {
  for (let digits = 6; ; digits += 2) {
    if (Math.pow(10, digits - 2) > (1 << clubCount) - 1) return digits
  }
}

export function formatClubCode(code: string): string {
  const mid = Math.floor(code.length / 2)
  return code.slice(0, mid) + ' ' + code.slice(mid)
}

function simpleHash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return hash
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    ;[a, b] = [b, a % b]
  }
  return a
}

function modInverse(a: number, m: number): number {
  let t = 0
  let newT = 1
  let r = m
  let newR = a
  while (newR !== 0) {
    const q = Math.floor(r / newR)
    ;[t, newT] = [newT, t - q * newT]
    ;[r, newR] = [newR, r - q * newR]
  }
  return ((t % m) + m) % m
}

function deriveKeys(secret: string, space: number): { a: number; b: number } {
  const h1 = Math.abs(simpleHash(secret + '\0key'))
  const h2 = Math.abs(simpleHash(secret + '\0offset'))

  let a = (h1 % (space - 2)) + 2 // range [2, space-1], avoid 1
  while (gcd(a, space) !== 1) {
    a = a + 1 >= space ? 2 : a + 1
  }

  const b = h2 % space
  return { a, b }
}

function clubsToMask(selectedClubs: string[], allClubs: string[]): number {
  let mask = 0
  for (const club of selectedClubs) {
    const idx = allClubs.indexOf(club)
    if (idx >= 0) mask |= 1 << idx
  }
  return mask
}

function maskToClubs(mask: number, allClubs: string[]): string[] {
  const clubs: string[] = []
  for (let i = 0; i < allClubs.length; i++) {
    if (mask & (1 << i)) clubs.push(allClubs[i])
  }
  return clubs.sort()
}

function encode(mask: number, a: number, b: number, space: number): number {
  return Number((BigInt(a) * BigInt(mask) + BigInt(b)) % BigInt(space))
}

function decode(code: number, a: number, b: number, space: number): number {
  const aInv = modInverse(a, space)
  return Number(
    (BigInt(aInv) * ((BigInt(code) - BigInt(b) + BigInt(space)) % BigInt(space))) % BigInt(space),
  )
}

function checksum(mask: number, secret: string): number {
  return Math.abs(simpleHash(String(mask) + '\0check\0' + secret)) % 100
}

export function generateClubCode(
  selectedClubs: string[],
  allClubs: string[],
  secret: string,
): string {
  const n = allClubs.length
  if (n === 0 || n > MAX_CLUBS) return ''
  const digits = codeLength(n)
  const payloadDigits = digits - 2
  const payloadSpace = Math.pow(10, payloadDigits)
  const { a, b } = deriveKeys(secret, payloadSpace)
  const mask = clubsToMask(selectedClubs, allClubs)
  if (mask === 0) return ''
  const payload = encode(mask, a, b, payloadSpace)
  const check = checksum(mask, secret)
  return String(payload).padStart(payloadDigits, '0') + String(check).padStart(2, '0')
}

export function verifyClubCode(
  rawCode: string,
  allClubs: string[],
  secret: string,
): string[] | null {
  const code = rawCode.replace(/[-\s]/g, '')
  const n = allClubs.length
  if (n === 0 || n > MAX_CLUBS) return null
  const digits = codeLength(n)
  if (code.length !== digits) return null
  const payloadDigits = digits - 2
  const payloadSpace = Math.pow(10, payloadDigits)
  const payloadNum = parseInt(code.slice(0, payloadDigits), 10)
  const checkNum = parseInt(code.slice(payloadDigits), 10)
  if (isNaN(payloadNum) || isNaN(checkNum)) return null
  if (payloadNum < 0 || payloadNum >= payloadSpace) return null
  const { a, b } = deriveKeys(secret, payloadSpace)
  const mask = decode(payloadNum, a, b, payloadSpace)
  if (mask < 1 || mask > (1 << n) - 1) return null
  if (checkNum !== checksum(mask, secret)) return null
  return maskToClubs(mask, allClubs)
}
