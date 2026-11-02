import { timingSafeEqual } from 'node:crypto'
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb, schema } from '../db/index.js'
import {
  clientIp, createSession, destroySession, destroyUserSessions, fail, hashPassword, newToken, rateLimit, requireUser,
  sha256, verifyPassword, type AppEnv,
} from '../auth.js'
import { linkEmail, mailConfigured, sendMail } from '../mail.js'
import { logActivity, saveSettings } from '../common.js'
import { DEFAULT_ROLES } from '../../shared/permissions.js'
import { MIN_PASSWORD } from '../../shared/constants.js'
import { defaultSettings } from '../../shared/scoring.js'

const email = z.string().trim().toLowerCase().email().max(200)
const password = z.string().min(MIN_PASSWORD, `كلمة المرور ${MIN_PASSWORD} أحرف على الأقل`).max(200)
const TOKEN_MINUTES = 60

async function findByEmail(e: string) {
  const db = await getDb()
  const [u] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${e}`)
  return u
}

// Creates a one-time link for activation (no password yet) or reset; returns the URL.
export async function issueLink(origin: string, user: { id: number; passwordHash: string | null }) {
  const db = await getDb()
  const token = newToken()
  const purpose = user.passwordHash ? 'reset' : 'activate'
  await db.insert(schema.authTokens).values({
    id: sha256(token),
    userId: user.id,
    purpose,
    expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000).toISOString(),
  })
  return { link: `${origin}/set-password?token=${token}`, purpose } as const
}

export const appOrigin = (url: string) => process.env.APP_URL ?? new URL(url).origin

export const authRoutes = new Hono<AppEnv>()
  .get('/me', (c) => c.json(c.get('user')))

  .post('/login', async (c) => {
    const body = z.object({ email, password: z.string().max(200) }).safeParse(await c.req.json())
    if (!body.success) fail(400, 'أدخل البريد وكلمة المرور')
    const { email: e, password: pw } = body.data
    await rateLimit(`login:${e}`, 8, 900)
    await rateLimit(`login-ip:${clientIp(c)}`, 40, 900)

    const user = await findByEmail(e)
    const ok = await verifyPassword(pw, user?.passwordHash ?? null)
    if (!user || !ok) fail(401, 'البريد أو كلمة المرور غير صحيحة')
    if (user.status !== 'active') fail(403, 'الحساب موقوف، راجع إدارة السكن')

    await createSession(c, user.id)
    c.set('user', { id: user.id } as never)
    await logActivity(c, 'auth.login')
    return c.json({ ok: true })
  })

  .post('/logout', async (c) => {
    await destroySession(c)
    return c.json({ ok: true })
  })

  // Activation and forgotten password share one flow; the reply never reveals whether the email exists.
  .post('/email-link', async (c) => {
    const body = z.object({ email }).safeParse(await c.req.json())
    if (!body.success) fail(400, 'البريد غير صحيح')
    if (!mailConfigured() && process.env.NODE_ENV === 'production') fail(503, 'خدمة البريد غير مفعلة حالياً، راجع إدارة السكن')
    await rateLimit(`link:${body.data.email}`, 3, 3600)
    await rateLimit(`link-ip:${clientIp(c)}`, 20, 3600)

    const user = await findByEmail(body.data.email)
    if (user && user.status === 'active') {
      const { link, purpose } = await issueLink(appOrigin(c.req.url), user)
      await sendMail({ to: user.email, ...linkEmail(user.name, purpose, link) })
    }
    return c.json({ ok: true })
  })

  .get('/token-info', async (c) => {
    const token = c.req.query('token') ?? ''
    const db = await getDb()
    const [row] = await db
      .select({ purpose: schema.authTokens.purpose, name: schema.users.name })
      .from(schema.authTokens)
      .innerJoin(schema.users, eq(schema.users.id, schema.authTokens.userId))
      .where(and(eq(schema.authTokens.id, sha256(token)), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, sql`now()`)))
    return c.json(row ? { valid: true, ...row } : { valid: false })
  })

  .post('/set-password', async (c) => {
    const body = z.object({ token: z.string().min(10).max(200), password }).safeParse(await c.req.json())
    if (!body.success) fail(400, body.error.issues[0]?.message ?? 'بيانات غير صحيحة')
    await rateLimit(`setpw-ip:${clientIp(c)}`, 20, 3600)
    const db = await getDb()
    // Marking the token used in the same statement that checks it prevents double use.
    const [tok] = await db
      .update(schema.authTokens)
      .set({ usedAt: sql`now()` })
      .where(and(eq(schema.authTokens.id, sha256(body.data.token)), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, sql`now()`)))
      .returning()
    if (!tok) fail(400, 'الرابط غير صالح أو منتهي، اطلب رابطاً جديداً')

    await db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(body.data.password), activatedAt: sql`coalesce(${schema.users.activatedAt}, now())` })
      .where(eq(schema.users.id, tok.userId))
    await destroyUserSessions(tok.userId)
    await createSession(c, tok.userId)
    c.set('user', { id: tok.userId } as never)
    await logActivity(c, tok.purpose === 'activate' ? 'auth.activated' : 'auth.password_reset')
    return c.json({ ok: true })
  })

  .post('/change-password', async (c) => {
    const user = requireUser(c)
    const body = z.object({ current: z.string().max(200), next: password }).safeParse(await c.req.json())
    if (!body.success) fail(400, body.error.issues[0]?.message ?? 'بيانات غير صحيحة')
    await rateLimit(`chpw:${user.id}`, 10, 900)
    const db = await getDb()
    const [row] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id))
    if (!(await verifyPassword(body.data.current, row?.hash ?? null))) fail(400, 'كلمة المرور الحالية غير صحيحة')
    await db.update(schema.users).set({ passwordHash: await hashPassword(body.data.next) }).where(eq(schema.users.id, user.id))
    await destroyUserSessions(user.id)
    await createSession(c, user.id)
    await logActivity(c, 'auth.password_changed')
    return c.json({ ok: true })
  })

// One-time creation of the dean's account. Needs SETUP_TOKEN (set in Vercel) and stops working once a super admin exists.
export const setupRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const db = await getDb()
    const [{ n }] = await db.select({ n: count() }).from(schema.users).where(eq(schema.users.isSuper, true))
    return c.json({ needed: n === 0, enabled: Boolean(process.env.SETUP_TOKEN) || process.env.NODE_ENV !== 'production' })
  })
  .post('/', async (c) => {
    await rateLimit(`setup-ip:${clientIp(c)}`, 10, 3600)
    const body = z
      .object({ token: z.string().max(200), name: z.string().trim().min(2).max(100), email, password })
      .safeParse(await c.req.json())
    if (!body.success) fail(400, body.error.issues[0]?.message ?? 'بيانات غير صحيحة')

    const expected = process.env.SETUP_TOKEN ?? (process.env.NODE_ENV !== 'production' ? 'dev' : '')
    const a = Buffer.from(sha256(body.data.token))
    const b = Buffer.from(sha256(expected))
    if (!expected || !timingSafeEqual(a, b)) fail(403, 'رمز الإعداد غير صحيح')

    const db = await getDb()
    const [{ n }] = await db.select({ n: count() }).from(schema.users).where(eq(schema.users.isSuper, true))
    if (n > 0) fail(409, 'تم الإعداد مسبقاً')

    const [{ roleCount }] = await db.select({ roleCount: count() }).from(schema.roles)
    if (roleCount === 0) await db.insert(schema.roles).values(DEFAULT_ROLES)
    await saveSettings(defaultSettings())

    const [user] = await db
      .insert(schema.users)
      .values({
        kind: 'staff', name: body.data.name, email: body.data.email, isSuper: true,
        passwordHash: await hashPassword(body.data.password), activatedAt: sql`now()`,
      })
      .returning({ id: schema.users.id })
    await createSession(c, user.id)
    c.set('user', { id: user.id } as never)
    await logActivity(c, 'setup.completed')
    return c.json({ ok: true })
  })
