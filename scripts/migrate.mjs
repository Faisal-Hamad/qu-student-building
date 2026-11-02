// Runs during the Vercel build, before the site is deployed, so the API never sees an old schema.
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

const url = process.env.DATABASE_URL ?? process.env.DATABASE_POSTGRES_URL ?? process.env.POSTGRES_URL
if (!url) {
  console.warn('[migrate] DATABASE_URL is not set; skipping migrations.')
  process.exit(0)
}

await migrate(drizzle(neon(url)), { migrationsFolder: './drizzle' })
console.log('[migrate] database schema is up to date.')
