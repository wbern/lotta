export const adjectives = [
  'stora',
  'lilla',
  'glada',
  'fina',
  'fria',
  'lugna',
  'milda',
  'vilda',
  'kloka',
  'modiga',
  'raska',
  'snalla',
  'muntra',
  'pigga',
  'livliga',
  'vackra',
  'stolta',
  'trygga',
  'ljusa',
  'varma',
  'grona',
  'blaa',
  'vita',
  'breda',
  'djupa',
  'hoga',
  'rena',
  'friska',
  'kvicka',
  'smidiga',
]

export const nouns = [
  'vargen',
  'bjornen',
  'algen',
  'raven',
  'ornen',
  'falken',
  'svanen',
  'lodjuret',
  'haren',
  'ekorren',
  'uttern',
  'bavern',
  'hjorten',
  'laxen',
  'tranan',
  'ugglan',
  'duvan',
  'delfinen',
  'hajen',
  'korpen',
  'grodan',
  'biet',
  'myran',
  'draken',
  'gripen',
  'fenixen',
  'lejonet',
  'tigern',
  'pantern',
  'geparden',
  'elefanten',
  'giraffen',
  'pingvinen',
  'humlan',
]

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

interface Options {
  includeYear?: boolean
}

export function generateRandomName(options?: Options): string {
  const { includeYear = true } = options ?? {}
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const base = `${capitalize(adj)} ${capitalize(noun)}`
  return includeYear ? `${base} ${new Date().getFullYear()}` : base
}
