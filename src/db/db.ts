import initSqlJs, { type Database } from 'sql.js'

export async function initDatabase(data?: Uint8Array): Promise<Database> {
  const config =
    typeof import.meta.env !== 'undefined' && import.meta.env.MODE !== 'test'
      ? { locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}` }
      : undefined
  const SQL = await initSqlJs(config)
  const db = data ? new SQL.Database(data) : new SQL.Database()
  db.run('PRAGMA foreign_keys = ON')
  return db
}
