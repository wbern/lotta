interface RollbackBuildConfig {
  base: string
  cacheId: string
  manifestId: string
  manifestName: string
  manifestShortName: string
}

export function rollbackBuildConfig(version: string | null): RollbackBuildConfig | null {
  if (!version) return null
  return {
    base: `/v/${version}/`,
    cacheId: `lotta-v${version}`,
    manifestId: `/v/${version}/`,
    manifestName: `Lotta v${version} (arkiv)`,
    manifestShortName: `Lotta v${version}`,
  }
}
