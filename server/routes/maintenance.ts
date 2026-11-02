import { and, count, desc, eq, gt, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb, schema, type DB } from '../db/index.js'
import { can, fail, inScope, rateLimit, requirePerm, requireUser, type AppEnv, type AuthUser } from '../auth.js'
import { logActivity, notifyStaff, notifyUser } from '../common.js'
import { DUPLICATE_WINDOW_HOURS, LOCATIONS, PROBLEM_TYPES, STATUSES, type Status } from '../../shared/constants.js'
import type { MaintenanceEvent, MaintenanceRequest } from '../../shared/types.js'

const m = schema.maintenanceRequests
const student = alias(schema.users, 'student')
const assignee = alias(schema.users, 'assignee')
const id = z.coerce.number().int().positive()
const statusEnum = z.enum(Object.keys(STATUSES) as [Status, ...Status[]])

const cols = {
  id: m.id, sr: m.sr, studentId: m.studentId, studentName: student.name, studentUniversityId: student.universityId, studentPhone: student.phone,
  roomId: m.roomId, locationLabel: m.locationLabel, location: m.location, problemType: m.problemType, description: m.description,
  status: m.status, assignedTo: m.assignedTo, assignedName: assignee.name, createdAt: m.createdAt, updatedAt: m.updatedAt, completedAt: m.completedAt,
  buildingId: schema.wings.buildingId,
}

// Takes the db instead of awaiting it: Drizzle builders are thenable, so returning one from an async
// function would run the query before the caller adds its filters.
const baseQuery = (db: DB) =>
  db
    .select(cols)
    .from(m)
    .innerJoin(student, eq(student.id, m.studentId))
    .leftJoin(assignee, eq(assignee.id, m.assignedTo))
    .leftJoin(schema.rooms, eq(schema.rooms.id, m.roomId))
    .leftJoin(schema.wings, eq(schema.wings.id, schema.rooms.wingId))
    .$dynamic()

function scopeCond(user: AuthUser): SQL | undefined {
  if (!user.scopeBuildingIds) return undefined
  return inArray(schema.wings.buildingId, user.scopeBuildingIds.length ? user.scopeBuildingIds : [-1])
}

async function loadVisible(user: AuthUser, rid: number) {
  const [row] = await baseQuery(await getDb()).where(eq(m.id, rid))
  if (!row) fail(404, 'البلاغ غير موجود')
  if (user.kind === 'student') {
    if (row.studentId !== user.id) fail(404, 'البلاغ غير موجود')
  } else if (!can(user, 'maintenance.list') || !inScope(user, row.buildingId)) fail(403, 'غير مصرح')
  return row
}

const strip = ({ buildingId: _b, ...r }: Awaited<ReturnType<typeof loadVisible>>) => r as MaintenanceRequest

export const maintenanceRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const user = requireUser(c)
    const conds: SQL[] = []
    let pageSize = Math.min(200, Math.max(1, Number(c.req.query('pageSize') ?? 30)))

    if (user.kind === 'student') {
      if (!can(user, 'portal.maintenance_view')) fail(403, 'غير مصرح')
      conds.push(eq(m.studentId, user.id))
    } else {
      requirePerm(c, 'maintenance.list')
      if (c.req.query('export') === '1') {
        requirePerm(c, 'maintenance.export')
        pageSize = 20000
      }
      const scope = scopeCond(user)
      if (scope) conds.push(scope)
      const { status, type, buildingId, q, mine } = c.req.query()
      if (status === 'open') conds.push(inArray(m.status, ['new', 'in_progress']))
      else if (status && status in STATUSES) conds.push(eq(m.status, status as Status))
      if (type && type in PROBLEM_TYPES) conds.push(eq(m.problemType, type as keyof typeof PROBLEM_TYPES))
      if (buildingId) conds.push(eq(schema.wings.buildingId, Number(buildingId)))
      if (mine === '1') conds.push(eq(m.assignedTo, user.id))
      if (q?.trim()) {
        const t = `%${q.trim()}%`
        conds.push(or(ilike(m.sr, t), ilike(student.name, t), ilike(student.universityId, t), ilike(m.locationLabel, t))!)
      }
    }

    const page = Math.max(1, Number(c.req.query('page') ?? 1))
    const where = conds.length ? and(...conds) : undefined
    const db = await getDb()
    const [rows, [{ total }]] = await Promise.all([
      baseQuery(db).where(where).orderBy(desc(m.id)).limit(pageSize).offset((page - 1) * pageSize),
      db
        .select({ total: count() })
        .from(m)
        .innerJoin(student, eq(student.id, m.studentId))
        .leftJoin(schema.rooms, eq(schema.rooms.id, m.roomId))
        .leftJoin(schema.wings, eq(schema.wings.id, schema.rooms.wingId))
        .where(where),
    ])
    return c.json({ rows: rows.map(strip), total })
  })

  .get('/stats', async (c) => {
    const user = requirePerm(c, 'maintenance.list')
    const db = await getDb()
    const rows = await db
      .select({ status: m.status, type: m.problemType, n: count() })
      .from(m)
      .leftJoin(schema.rooms, eq(schema.rooms.id, m.roomId))
      .leftJoin(schema.wings, eq(schema.wings.id, schema.rooms.wingId))
      .where(scopeCond(user))
      .groupBy(m.status, m.problemType)
    return c.json(rows)
  })

  .get('/:id', async (c) => {
    const user = requireUser(c)
    const row = await loadVisible(user, id.parse(c.req.param('id')))
    const db = await getDb()
    const events = await db
      .select({
        id: schema.maintenanceEvents.id, actorName: schema.users.name, action: schema.maintenanceEvents.action,
        fromStatus: schema.maintenanceEvents.fromStatus, toStatus: schema.maintenanceEvents.toStatus,
        note: schema.maintenanceEvents.note, createdAt: schema.maintenanceEvents.createdAt,
      })
      .from(schema.maintenanceEvents)
      .leftJoin(schema.users, eq(schema.users.id, schema.maintenanceEvents.actorId))
      .where(eq(schema.maintenanceEvents.requestId, row.id))
      .orderBy(schema.maintenanceEvents.id)
    return c.json({ request: strip(row), events: events as MaintenanceEvent[] })
  })

  .post('/', async (c) => {
    const user = requireUser(c, 'student')
    if (!can(user, 'portal.maintenance_create')) fail(403, 'ليس لديك صلاحية رفع البلاغات')
    if (user.requestsBlocked) fail(403, 'تم إيقاف استقبال البلاغات من حسابك، راجع إدارة السكن')
    if (!user.room) fail(400, 'لا توجد غرفة مسجلة لحسابك، راجع إدارة السكن')
    const body = z
      .object({
        location: z.enum(Object.keys(LOCATIONS) as [keyof typeof LOCATIONS, ...(keyof typeof LOCATIONS)[]]),
        problemType: z.enum(Object.keys(PROBLEM_TYPES) as [keyof typeof PROBLEM_TYPES, ...(keyof typeof PROBLEM_TYPES)[]]),
        description: z.string().trim().min(5, 'اكتب وصفاً مختصراً للمشكلة').max(1000),
        qrWingId: z.number().int().positive().optional(),
      })
      .parse(await c.req.json())
    if (body.qrWingId && body.qrWingId !== user.room.wingId) fail(400, 'هذا الباركود لجناح آخر غير جناحك')
    await rateLimit(`mr:${user.id}`, 10, 86400)

    const db = await getDb()
    const roomId = user.room.roomId
    const same = and(eq(m.studentId, user.id), eq(m.roomId, roomId), eq(m.problemType, body.problemType))

    // Rule 3: an open request for the same problem blocks a new one until it is done.
    const [open] = await db.select({ sr: m.sr }).from(m).where(and(same, inArray(m.status, ['new', 'in_progress'])))
    if (open) fail(409, `لديك بلاغ قائم رقم ${open.sr} لنفس المشكلة، يرجى الانتظار حتى الإنجاز`)
    // Rule 2: no duplicate (student + room + problem type) within 24 hours, even if the earlier one was closed.
    const [recent] = await db
      .select({ sr: m.sr })
      .from(m)
      .where(and(same, ne(m.status, 'rejected'), gt(m.createdAt, sql`now() - make_interval(hours => ${DUPLICATE_WINDOW_HOURS}::int)`)))
    if (recent) fail(409, `تم رفع بلاغ مماثل خلال آخر ${DUPLICATE_WINDOW_HOURS} ساعة (رقم ${recent.sr})`)

    const r = user.room
    const locationLabel = `${r.buildingName} · جناح ${r.wingNumber}${body.location === 'room' ? ` · غرفة ${r.roomNumber}` : ` · ${LOCATIONS[body.location]}`}`
    const [row] = await db
      .insert(m)
      .values({ studentId: user.id, roomId, locationLabel, location: body.location, problemType: body.problemType, description: body.description })
      .returning({ id: m.id, sr: m.sr })
      .catch(() => fail(409, 'لديك بلاغ قائم لنفس المشكلة، يرجى الانتظار حتى الإنجاز'))
    await db.insert(schema.maintenanceEvents).values({ requestId: row.id, actorId: user.id, action: 'created', toStatus: 'new' })

    // Rule 1: notify the responsible staff (in-app).
    await notifyStaff('maintenance.notify', r.buildingId, {
      title: `بلاغ جديد ${row.sr} — ${PROBLEM_TYPES[body.problemType]}`,
      body: `${user.name} · ${locationLabel}`,
      link: `/admin/maintenance?open=${row.id}`,
    })
    await logActivity(c, 'maintenance.created', { requestId: row.id, sr: row.sr })
    return c.json(row)
  })

  .patch('/:id', async (c) => {
    const user = requirePerm(c, 'maintenance.update', 'maintenance.assign')
    const row = await loadVisible(user, id.parse(c.req.param('id')))
    const body = z
      .object({ status: statusEnum.optional(), assignedTo: id.nullable().optional(), note: z.string().trim().max(1000).optional() })
      .parse(await c.req.json())
    const db = await getDb()
    const events: (typeof schema.maintenanceEvents.$inferInsert)[] = []
    const set: Partial<typeof m.$inferInsert> = {}

    if (body.status && body.status !== row.status) {
      if (!can(user, 'maintenance.update')) fail(403, 'ليس لديك صلاحية تحديث الحالة')
      set.status = body.status
      set.completedAt = body.status === 'done' ? sql`now()` as never : null
      events.push({ requestId: row.id, actorId: user.id, action: 'status', fromStatus: row.status, toStatus: body.status, note: body.note || null })
    } else if (body.note) {
      if (!can(user, 'maintenance.update')) fail(403, 'غير مصرح')
      events.push({ requestId: row.id, actorId: user.id, action: 'note', note: body.note })
    }

    if (body.assignedTo !== undefined && body.assignedTo !== row.assignedTo) {
      if (!can(user, 'maintenance.assign')) fail(403, 'ليس لديك صلاحية الإسناد')
      if (body.assignedTo) {
        const [a] = await db
          .select({ id: schema.users.id, name: schema.users.name })
          .from(schema.users)
          .where(and(eq(schema.users.id, body.assignedTo), eq(schema.users.kind, 'staff'), eq(schema.users.status, 'active')))
        if (!a) fail(400, 'الموظف غير موجود')
        events.push({ requestId: row.id, actorId: user.id, action: 'assigned', note: a.name })
        await notifyUser(a.id, { title: `أُسند إليك البلاغ ${row.sr}`, body: row.locationLabel, link: `/admin/maintenance?open=${row.id}` })
      } else {
        events.push({ requestId: row.id, actorId: user.id, action: 'assigned', note: null })
      }
      set.assignedTo = body.assignedTo
    }

    if (Object.keys(set).length) await db.update(m).set({ ...set, updatedAt: sql`now()` as never }).where(eq(m.id, row.id))
    if (events.length) await db.insert(schema.maintenanceEvents).values(events)
    if (set.status) {
      await notifyUser(row.studentId, {
        title: `تحديث البلاغ ${row.sr}: ${STATUSES[set.status]}`,
        body: body.note ?? '',
        link: `/student/requests?open=${row.id}`,
      })
    }
    await logActivity(c, 'maintenance.updated', { requestId: row.id, sr: row.sr, ...body })
    return c.json({ ok: true })
  })

  .delete('/:id', async (c) => {
    const user = requirePerm(c, 'maintenance.delete')
    const row = await loadVisible(user, id.parse(c.req.param('id')))
    const db = await getDb()
    await db.delete(m).where(eq(m.id, row.id))
    await logActivity(c, 'maintenance.deleted', { requestId: row.id, sr: row.sr })
    return c.json({ ok: true })
  })

