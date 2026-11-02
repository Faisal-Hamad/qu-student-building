import { handle } from 'hono/vercel'
import { app } from '../server/app.js'

// All /api/* requests are rewritten here (vercel.json) and routed by Hono.
const handler = handle(app)
export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
