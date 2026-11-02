// Local API server for development: `bun run dev:api` (Vite proxies /api here).
import { app } from './app.js'
import { getDb } from './db/index.js'

await getDb()
const port = Number(process.env.API_PORT ?? 8787)
Bun.serve({ port, fetch: app.fetch })
console.log(`API ready on http://localhost:${port}`)
