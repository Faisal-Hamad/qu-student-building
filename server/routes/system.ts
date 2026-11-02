import { timingSafeEqual } from 'node:crypto'
import { and, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import writeXlsxFile from 'write-excel-file/node'
import { getDb, schema } from '../db/index.js'
import { fail, requirePerm, requireUser, sha256, type AppEnv } from '../auth.js'
import { getSettings, logActivity } from '../common.js'
import { mailConfigured, sendMail } from '../mail.js'
import { LOCATIONS, PROBLEM_TYPES, STATUSES } from '../../shared/constants.js'

export const notificationRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const user = requireUser(c)
    const db = await getDb()
    const n = schema.notifications
    const [rows, [{ unread }]] = await Promise.all([
      db.select().from(n).where(eq(n.userId, user.id)).orderBy(desc(n.id)).limit(30),
      db.select({ unread: count() }).from(n).where(and(eq(n.userId, user.id), isNull(n.readAt))),
    ])
    return c.json({ rows, unread })
  })
  .post('/read', async (c) => {
    const user = requireUser(c)
    const body = z.object({ ids: z.array(z.number().int()).max(100).optional() }).parse(await c.req.json())
    const db = await getDb()
    const n = schema.notifications
    await db
      .update(n)
      .set({ readAt: sql`now()` as never })
      .where(and(eq(n.userId, user.id), isNull(n.readAt), body.ids ? inArray(n.id, body.ids) : undefined))
    return c.json({ ok: true })
  })

export const activityRoutes = new Hono<AppEnv>().get('/', async (c) => {
  requirePerm(c, 'activity.view')
  const page = Math.max(1, Number(c.req.query('page') ?? 1))
  const db = await getDb()
  const a = schema.activityLog
  const rows = await db
    .select({ id: a.id, actorName: schema.users.name, action: a.action, details: a.details, ip: a.ip, createdAt: a.createdAt })
    .from(a)
    .leftJoin(schema.users, eq(schema.users.id, a.actorId))
    .orderBy(desc(a.id))
    .limit(50)
    .offset((page - 1) * 50)
  return c.json(rows)
})

/* ---------- backups ---------- */

// Everything needed to rebuild the data, minus secrets (password hashes, sessions, tokens).
async function snapshot() {
  const db = await getDb()
  const u = schema.users
  const [buildings, wings, rooms, roles, users, requests, events, inspections, settings] = await Promise.all([
    db.select().from(schema.buildings),
    db.select().from(schema.wings),
    db.select().from(schema.rooms),
    db.select().from(schema.roles),
    db
      .select({ id: u.id, kind: u.kind, name: u.name, email: u.email, universityId: u.universityId, phone: u.phone, roleId: u.roleId, isSuper: u.isSuper, status: u.status, requestsBlocked: u.requestsBlocked, roomId: u.roomId, scopeBuildingIds: u.scopeBuildingIds, createdAt: u.createdAt })
      .from(u),
    db.select().from(schema.maintenanceRequests),
    db.select().from(schema.maintenanceEvents),
    db.select().from(schema.inspections),
    getSettings(),
  ])
  return { exportedAt: new Date().toISOString(), buildings, wings, rooms, roles, users, maintenanceRequests: requests, maintenanceEvents: events, inspections, settings }
}

async function requestsWorkbook(snap: Awaited<ReturnType<typeof snapshot>>) {
  const userById = new Map(snap.users.map((x) => [x.id, x]))
  const rows = snap.maintenanceRequests.map((r) => ({
    sr: r.sr ?? '', name: userById.get(r.studentId)?.name ?? '', uni: userById.get(r.studentId)?.universityId ?? '',
    place: r.locationLabel, location: LOCATIONS[r.location], type: PROBLEM_TYPES[r.problemType], description: r.description,
    status: STATUSES[r.status], tech: r.assignedTo ? userById.get(r.assignedTo)?.name ?? '' : '', created: r.createdAt, done: r.completedAt ?? '',
  }))
  type R = (typeof rows)[number]
  const col = (column: string, value: (r: R) => string, width = 18) => ({ column, type: String, value, width })
  return writeXlsxFile(rows, {
    buffer: true,
    rightToLeft: true,
    schema: [
      col('رقم البلاغ', (r) => r.sr, 12), col('اسم الطالب', (r) => r.name, 24), col('الرقم الجامعي', (r) => r.uni, 14),
      col('الموقع', (r) => r.place, 30), col('المكان', (r) => r.location, 12), col('نوع المشكلة', (r) => r.type, 12),
      col('الوصف', (r) => r.description, 40), col('الحالة', (r) => r.status, 12), col('الفني', (r) => r.tech, 20),
      col('تاريخ البلاغ', (r) => r.created, 22), col('تاريخ الإنجاز', (r) => r.done, 22),
    ],
  }) as Promise<Buffer>
}

export const backupRoutes = new Hono<AppEnv>().get('/', async (c) => {
  requirePerm(c, 'settings.backup')
  const snap = await snapshot()
  await logActivity(c, 'backup.downloaded')
  c.header('Content-Disposition', `attachment; filename="sakan-backup-${snap.exportedAt.slice(0, 10)}.json"`)
  return c.json(snap)
})

// Called daily by Vercel Cron (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export const cronRoutes = new Hono<AppEnv>().get('/daily', async (c) => {
  const secret = process.env.CRON_SECRET
  const given = c.req.header('authorization') ?? ''
  if (!secret || !timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(sha256(`Bearer ${secret}`)))) fail(401, 'unauthorized')

  const db = await getDb()
  // Housekeeping: drop expired sessions, used/expired tokens and stale rate-limit rows.
  await Promise.all([
    db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, sql`now()`)),
    db.delete(schema.authTokens).where(lt(schema.authTokens.expiresAt, sql`now() - interval '1 day'`)),
    db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, sql`now() - interval '1 day'`)),
  ])

  const s = await getSettings()
  if (!s.backupEmail || !mailConfigured()) return c.json({ ok: true, emailed: false })
  const snap = await snapshot()
  const day = snap.exportedAt.slice(0, 10)
  await sendMail({
    to: s.backupEmail,
    subject: `النسخة الاحتياطية اليومية — نظام السكن الطلابي ${day}`,
    text: `مرفق نسخة احتياطية كاملة (JSON) وملف Excel لبلاغات الصيانة بتاريخ ${day}.\nعدد البلاغات: ${snap.maintenanceRequests.length}\nعدد التقييمات: ${snap.inspections.length}`,
    attachments: [
      { filename: `sakan-backup-${day}.json`, content: JSON.stringify(snap) },
      { filename: `maintenance-${day}.xlsx`, content: await requestsWorkbook(snap) },
    ],
  })
  return c.json({ ok: true, emailed: true })
})
