interface RollbackBuildConfig {
  base: string
  cacheId: string
}

export function rollbackBuildConfig(version: string | null): RollbackBuildConfig | null {
  if (!version) return null
  return {
    base: `/v/${version}/`,
    cacheId: `lotta-v${version}`,
  }
}
