export function dbName(base: string, rollbackVersion: string | null): string {
  return rollbackVersion ? `${base}-v${rollbackVersion}` : base
}
