import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

export type DB = NeonHttpDatabase<typeof schema>

let db: DB | undefined
let ready: Promise<DB> | undefined

// Production uses Neon over HTTP (DATABASE_URL is injected by the Vercel integration).
// Local development without DATABASE_URL uses an embedded PGlite database in ./.data, migrated on start.
// Both expose the same Drizzle query API, so the rest of the server does not care which one is active.
export function getDb(): Promise<DB> {
  if (db) return Promise.resolve(db)
  if (!ready) {
    ready = (async () => {
      const url = process.env.DATABASE_URL
      if (url) {
        db = drizzle(neon(url), { schema })
      } else {
        const { PGlite } = await import('@electric-sql/pglite')
        const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite')
        const { migrate } = await import('drizzle-orm/pglite/migrator')
        const dir = process.env.PGLITE_DIR ?? './.data/pglite'
        if (!dir.includes('://')) (await import('node:fs')).mkdirSync(dir, { recursive: true })
        const client = new PGlite(dir)
        const local = drizzlePglite(client, { schema })
        await migrate(local, { migrationsFolder: './drizzle' })
        db = local as unknown as DB
      }
      return db
    })()
  }
  return ready
}

export { schema }
