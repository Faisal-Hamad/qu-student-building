import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { and, eq, gt, sql } from 'drizzle-orm'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { getDb, schema } from './db/index.js'
import type { Me } from '../shared/types.js'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const SESSION_COOKIE = 'sid'
const SESSION_DAYS = 30

/* ---------- passwords ---------- */

export async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 64, SCRYPT)
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(pw: string, stored: string | null) {
  // Hash against a dummy when the account has no password, so timing does not reveal which emails exist.
  const [, n, saltB64, keyB64] = (stored ?? `scrypt$16384$${'A'.repeat(22)}==$${'A'.repeat(86)}==`).split('$')
  const expected = Buffer.from(keyB64, 'base64')
  const key = await scrypt(pw, Buffer.from(saltB64, 'base64'), expected.length, { ...SCRYPT, N: Number(n) })
  return stored !== null && key.length === expected.length && timingSafeEqual(key, expected)
}

/* ---------- tokens ---------- */

export const newToken = () => randomBytes(32).toString('base64url')
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/* ---------- request helpers ---------- */

export function clientIp(c: Context) {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || null
}

export function fail(status: 400 | 401 | 403 | 404 | 409 | 429 | 503, message: string): never {
  throw new HTTPException(status, { message })
}

/* ---------- rate limiting (fixed window, stored in Postgres so it works across serverless instances) ---------- */

export async function rateLimit(key: string, max: number, windowSec: number) {
  const db = await getDb()
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`case when ${schema.rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}::int) then 1 else ${schema.rateLimits.count} + 1 end`,
        windowStart: sql`case when ${schema.rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}::int) then now() else ${schema.rateLimits.windowStart} end`,
      },
    })
    .returning({ count: schema.rateLimits.count })
  if (row.count > max) fail(429, 'محاولات كثيرة، حاول بعد قليل')
}

/* ---------- sessions ---------- */

export async function createSession(c: Context, userId: number) {
  const db = await getDb()
  const token = newToken()
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000)
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId,
    expiresAt: expires.toISOString(),
    ip: clientIp(c),
    userAgent: c.req.header('user-agent')?.slice(0, 300) ?? null,
  })
  await db.update(schema.users).set({ lastLoginAt: sql`now()` }).where(eq(schema.users.id, userId))
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    expires,
  })
}

export async function destroySession(c: Context) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    const db = await getDb()
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)))
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export async function destroyUserSessions(userId: number) {
  const db = await getDb()
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId))
}

export interface AuthUser extends Me {
  scopeBuildingIds: number[] | null
}

export async function loadMe(userId: number): Promise<AuthUser | null> {
  const db = await getDb()
  const u = schema.users
  const [row] = await db
    .select({
      id: u.id, kind: u.kind, name: u.name, email: u.email, universityId: u.universityId, isSuper: u.isSuper,
      status: u.status, requestsBlocked: u.requestsBlocked, roomId: u.roomId, scope: u.scopeBuildingIds,
      roleName: schema.roles.nameAr, rolePerms: schema.roles.permissions,
      roomNumber: schema.rooms.number, wingId: schema.wings.id, wingNumber: schema.wings.number,
      buildingId: schema.buildings.id, buildingName: schema.buildings.name,
    })
    .from(u)
    .leftJoin(schema.roles, eq(schema.roles.id, u.roleId))
    .leftJoin(schema.rooms, eq(schema.rooms.id, u.roomId))
    .leftJoin(schema.wings, eq(schema.wings.id, schema.rooms.wingId))
    .leftJoin(schema.buildings, eq(schema.buildings.id, schema.wings.buildingId))
    .where(eq(u.id, userId))
  if (!row || row.status !== 'active') return null

  let permissions = row.rolePerms ?? []
  if (row.kind === 'student' && !row.roleName) {
    // Students without an explicit role get the default student role.
    const [def] = await db.select().from(schema.roles).where(and(eq(schema.roles.kind, 'student'), eq(schema.roles.isDefault, true)))
    permissions = def?.permissions ?? []
  }
  if (row.isSuper) {
    const { ALL_PERMISSIONS, permissionsFor } = await import('../shared/permissions.js')
    permissions = ALL_PERMISSIONS.filter((p) => !permissionsFor('student').includes(p))
  }

  return {
    id: row.id, kind: row.kind, name: row.name, email: row.email, universityId: row.universityId, isSuper: row.isSuper,
    roleName: row.isSuper ? 'مدير النظام' : row.roleName, permissions, requestsBlocked: row.requestsBlocked,
    scopeBuildingIds: row.isSuper ? null : row.scope,
    room:
      row.roomId && row.wingId && row.buildingId
        ? { roomId: row.roomId, roomNumber: row.roomNumber!, wingId: row.wingId, wingNumber: row.wingNumber!, buildingId: row.buildingId, buildingName: row.buildingName! }
        : null,
  }
}

type Env = { Variables: { user: AuthUser | null } }
export type AppEnv = Env

export const sessionMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  c.set('user', null)
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    const db = await getDb()
    const [s] = await db
      .select({ userId: schema.sessions.userId })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, sql`now()`)))
    if (s) c.set('user', await loadMe(s.userId))
  }
  await next()
}

// Blocks cross-site form posts: state-changing requests must be same-origin JSON from our own frontend.
export const csrfMiddleware: MiddlewareHandler = async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && !c.req.path.startsWith('/api/cron/')) {
    const origin = c.req.header('origin')
    // Behind Vercel's edge or the Vite dev proxy the public host arrives in x-forwarded-host.
    const host = c.req.header('x-forwarded-host') ?? c.req.header('host') ?? new URL(c.req.url).host
    if (origin && new URL(origin).host !== host) fail(403, 'طلب غير مسموح')
    if (c.req.header('x-requested-with') !== 'fetch') fail(403, 'طلب غير مسموح')
  }
  await next()
}

export function requireUser(c: Context<Env>, kind?: 'staff' | 'student'): AuthUser {
  const user = c.get('user')
  if (!user) fail(401, 'يجب تسجيل الدخول')
  if (kind && user.kind !== kind) fail(403, 'غير مصرح')
  return user
}

export function can(user: AuthUser, perm: string) {
  return user.isSuper || user.permissions.includes(perm)
}

export function requirePerm(c: Context<Env>, ...perms: string[]): AuthUser {
  const user = requireUser(c)
  if (!perms.some((p) => can(user, p))) fail(403, 'ليس لديك صلاحية لهذا الإجراء')
  return user
}

export function inScope(user: AuthUser, buildingId: number | null | undefined) {
  return !user.scopeBuildingIds || (buildingId != null && user.scopeBuildingIds.includes(buildingId))
}
