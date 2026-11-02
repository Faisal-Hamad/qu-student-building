import { and, asc, count, eq, ilike, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { getDb, schema } from '../db/index.js'
import { can, destroyUserSessions, fail, inScope, requirePerm, type AppEnv, type AuthUser } from '../auth.js'
import { logActivity, roomContext } from '../common.js'
import { mailConfigured, linkEmail, sendMail } from '../mail.js'
import { appOrigin, issueLink } from './auth.js'
import { permissionsFor } from '../../shared/permissions.js'
import type { StaffRow, StudentRow } from '../../shared/types.js'

const id = z.coerce.number().int().positive()
const email = z.string().trim().toLowerCase().email('البريد غير صحيح').max(200)
const optText = (n: number) => z.string().trim().max(n).transform((s) => s || null).nullable().optional()
const u = schema.users

const isUniqueViolation = (e: unknown) => String((e as { code?: string })?.code ?? (e as Error)?.message).includes('23505') || /unique/i.test(String((e as Error)?.message))
const uniqueFail = (e: unknown): never => {
  if (isUniqueViolation(e)) fail(409, 'البريد أو الرقم الجامعي مستخدم لحساب آخر')
  throw e
}

async function assertRoomAvailable(roomId: number, exceptUserId?: number) {
  const db = await getDb()
  const [room] = await db.select().from(schema.rooms).where(eq(schema.rooms.id, roomId))
  if (!room) fail(400, 'الغرفة غير موجودة')
  const [{ n }] = await db
    .select({ n: count() })
    .from(u)
    .where(and(eq(u.roomId, roomId), exceptUserId ? ne(u.id, exceptUserId) : sql`true`))
  if (n >= room.capacity) fail(409, 'الغرفة ممتلئة')
}

async function roomBuilding(roomId: number | null) {
  return roomId ? (await roomContext(roomId))?.buildingId ?? null : null
}

async function loadStudentInScope(actor: AuthUser, studentId: number) {
  const db = await getDb()
  const [s] = await db.select().from(u).where(and(eq(u.id, studentId), eq(u.kind, 'student')))
  if (!s) fail(404, 'الطالب غير موجود')
  if (!inScope(actor, await roomBuilding(s.roomId))) fail(403, 'الطالب خارج نطاق مبانيك')
  return s
}

// A non-super user may only hand out permissions they hold themselves, so nobody can escalate via roles.
async function assertCanGrant(actor: AuthUser, perms: string[]) {
  if (actor.isSuper) return
  const missing = perms.filter((p) => !permissionsFor('student').includes(p) && !actor.permissions.includes(p))
  if (missing.length) fail(403, 'لا يمكنك منح صلاحيات لا تملكها')
}

async function assertCanAssignRole(actor: AuthUser, roleId: number | null | undefined, kind: 'staff' | 'student') {
  if (!roleId) return
  const db = await getDb()
  const [role] = await db.select().from(schema.roles).where(eq(schema.roles.id, roleId))
  if (!role || role.kind !== kind) fail(400, 'الصلاحية غير مناسبة لهذا النوع من الحسابات')
  await assertCanGrant(actor, role.permissions)
}

async function sendLinkTo(c: Context<AppEnv>, actor: AuthUser, target: typeof u.$inferSelect) {
  if (target.status !== 'active') fail(400, 'الحساب موقوف')
  const { link, purpose } = await issueLink(appOrigin(c.req.url), target)
  if (mailConfigured() || process.env.NODE_ENV !== 'production') {
    await sendMail({ to: target.email, ...linkEmail(target.name, purpose, link) })
    await logActivity(c, 'people.link_sent', { userId: target.id })
    return c.json({ sent: true })
  }
  // Without email configured, only the dean can see the link and pass it on by hand.
  if (!actor.isSuper) fail(503, 'خدمة البريد غير مفعلة')
  await logActivity(c, 'people.link_generated', { userId: target.id })
  return c.json({ sent: false, link })
}

const studentCols = {
  id: u.id, name: u.name, email: u.email, universityId: u.universityId, phone: u.phone, roomId: u.roomId, roleId: u.roleId,
  status: u.status, requestsBlocked: u.requestsBlocked, activated: sql<boolean>`${u.passwordHash} is not null`, lastLoginAt: u.lastLoginAt,
}

/* ---------------- students ---------------- */

const studentBody = z.object({
  name: z.string().trim().min(2, 'الاسم مطلوب').max(120),
  email,
  universityId: optText(30),
  phone: optText(30),
  roomId: id.nullable().optional(),
  roleId: id.nullable().optional(),
})

const importRow = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  universityId: optText(30),
  phone: optText(30),
  building: optText(60),
  wing: z.coerce.number().int().positive().nullable().optional(),
  room: z.coerce.number().int().positive().nullable().optional(),
})

export const studentRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const actor = requirePerm(c, 'students.list')
    const q = c.req.query('q')?.trim()
    const buildingId = c.req.query('buildingId') ? Number(c.req.query('buildingId')) : undefined
    const status = c.req.query('status')
    const page = Math.max(1, Number(c.req.query('page') ?? 1))
    const pageSize = Math.min(5000, Math.max(1, Number(c.req.query('pageSize') ?? 50)))

    const conds: SQL[] = [eq(u.kind, 'student')]
    if (q) conds.push(or(ilike(u.name, `%${q}%`), ilike(u.email, `%${q}%`), ilike(u.universityId, `%${q}%`))!)
    if (status === 'suspended') conds.push(eq(u.status, 'suspended'))
    if (status === 'blocked') conds.push(eq(u.requestsBlocked, true))
    if (status === 'inactive') conds.push(isNull(u.passwordHash))
    if (status === 'noroom') conds.push(isNull(u.roomId))
    let buildingIds = actor.scopeBuildingIds
    if (buildingId) buildingIds = buildingIds ? buildingIds.filter((b) => b === buildingId) : [buildingId]
    if (buildingIds) {
      const list = sql.join((buildingIds.length ? buildingIds : [-1]).map((b) => sql`${b}`), sql`, `)
      conds.push(inArray(u.roomId, sql`(select r.id from rooms r join wings w on w.id = r.wing_id where w.building_id in (${list}))`))
    }

    const db = await getDb()
    const where = and(...conds)
    const [rows, [{ total }]] = await Promise.all([
      db.select(studentCols).from(u).where(where).orderBy(asc(u.name)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ total: count() }).from(u).where(where),
    ])
    return c.json({ rows: rows as StudentRow[], total })
  })

  .post('/', async (c) => {
    const actor = requirePerm(c, 'students.create')
    const body = studentBody.parse(await c.req.json())
    if (body.roomId) {
      if (!inScope(actor, await roomBuilding(body.roomId))) fail(403, 'الغرفة خارج نطاق مبانيك')
      await assertRoomAvailable(body.roomId)
    }
    await assertCanAssignRole(actor, body.roleId, 'student')
    const db = await getDb()
    const [row] = await db.insert(u).values({ ...body, kind: 'student' }).returning({ id: u.id }).catch(uniqueFail)
    await logActivity(c, 'students.created', { userId: row.id, name: body.name })
    return c.json(row)
  })

  .patch('/:id', async (c) => {
    const actor = requirePerm(c, 'students.edit')
    const sid = id.parse(c.req.param('id'))
    await loadStudentInScope(actor, sid)
    const body = studentBody.partial().parse(await c.req.json())
    if (body.roomId) {
      if (!inScope(actor, await roomBuilding(body.roomId))) fail(403, 'الغرفة خارج نطاق مبانيك')
      await assertRoomAvailable(body.roomId, sid)
    }
    if (body.roleId !== undefined) await assertCanAssignRole(actor, body.roleId, 'student')
    const db = await getDb()
    await db.update(u).set(body).where(eq(u.id, sid)).catch(uniqueFail)
    await logActivity(c, 'students.updated', { userId: sid, fields: Object.keys(body) })
    return c.json({ ok: true })
  })

  .patch('/:id/flags', async (c) => {
    const actor = requirePerm(c, 'students.suspend', 'students.block_requests')
    const sid = id.parse(c.req.param('id'))
    await loadStudentInScope(actor, sid)
    const body = z.object({ status: z.enum(['active', 'suspended']).optional(), requestsBlocked: z.boolean().optional() }).parse(await c.req.json())
    if (body.status !== undefined && !can(actor, 'students.suspend')) fail(403, 'ليس لديك صلاحية إيقاف الحساب')
    if (body.requestsBlocked !== undefined && !can(actor, 'students.block_requests')) fail(403, 'ليس لديك صلاحية منع البلاغات')
    const db = await getDb()
    await db.update(u).set(body).where(eq(u.id, sid))
    if (body.status === 'suspended') await destroyUserSessions(sid)
    await logActivity(c, 'students.flags', { userId: sid, ...body })
    return c.json({ ok: true })
  })

  .delete('/:id', async (c) => {
    const actor = requirePerm(c, 'students.delete')
    const sid = id.parse(c.req.param('id'))
    const s = await loadStudentInScope(actor, sid)
    const db = await getDb()
    await db.delete(u).where(eq(u.id, sid))
    await logActivity(c, 'students.deleted', { userId: sid, name: s.name })
    return c.json({ ok: true })
  })

  .post('/:id/send-link', async (c) => {
    const actor = requirePerm(c, 'students.send_link')
    const s = await loadStudentInScope(actor, id.parse(c.req.param('id')))
    return sendLinkTo(c, actor, s)
  })

  // Rows are parsed from Excel in the browser; matching to rooms happens here. Existing emails are updated.
  .post('/import', async (c) => {
    const actor = requirePerm(c, 'students.import')
    const { rows, offset } = z.object({ rows: z.array(z.unknown()).max(500), offset: z.number().int().min(0).default(0) }).parse(await c.req.json())
    const db = await getDb()
    const [buildings, wings, rooms, existing, occupancy] = await Promise.all([
      db.select().from(schema.buildings),
      db.select().from(schema.wings),
      db.select().from(schema.rooms),
      db.select({ id: u.id, email: u.email, roomId: u.roomId }).from(u).where(eq(u.kind, 'student')),
      db.select({ roomId: u.roomId, n: count() }).from(u).groupBy(u.roomId),
    ])
    const byEmail = new Map(existing.map((s) => [s.email.toLowerCase(), s]))
    const used = new Map(occupancy.filter((o) => o.roomId).map((o) => [o.roomId!, o.n]))
    const findBuilding = (v: string) =>
      buildings.find((b) => b.name.trim() === v.trim()) ?? buildings.find((b) => b.name.replace(/\D/g, '') === v.replace(/\D/g, '') && /\d/.test(v))

    let created = 0
    let updated = 0
    const errors: { row: number; message: string }[] = []
    for (const [i, raw] of rows.entries()) {
      const parsed = importRow.safeParse(raw)
      if (!parsed.success) {
        errors.push({ row: offset + i + 2, message: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' })
        continue
      }
      const r = parsed.data
      let roomId: number | null | undefined
      if (r.building || r.wing || r.room) {
        const b = r.building ? findBuilding(r.building) : undefined
        const w = b && wings.find((x) => x.buildingId === b.id && x.number === r.wing)
        const room = w && rooms.find((x) => x.wingId === w.id && x.number === r.room)
        if (!room) {
          errors.push({ row: offset + i + 2, message: 'المبنى أو الجناح أو الغرفة غير موجود' })
          continue
        }
        if (!inScope(actor, b!.id)) {
          errors.push({ row: offset + i + 2, message: 'الغرفة خارج نطاق مبانيك' })
          continue
        }
        roomId = room.id
      }
      const prev = byEmail.get(r.email)
      if (roomId && prev?.roomId !== roomId) {
        if ((used.get(roomId) ?? 0) >= rooms.find((x) => x.id === roomId)!.capacity) {
          errors.push({ row: offset + i + 2, message: 'الغرفة ممتلئة' })
          continue
        }
        used.set(roomId, (used.get(roomId) ?? 0) + 1)
        if (prev?.roomId) used.set(prev.roomId, (used.get(prev.roomId) ?? 1) - 1)
      }
      const values = { name: r.name, email: r.email, universityId: r.universityId ?? null, phone: r.phone ?? null, ...(roomId !== undefined ? { roomId } : {}) }
      try {
        if (prev) {
          await db.update(u).set(values).where(eq(u.id, prev.id))
          updated++
        } else {
          const [row] = await db.insert(u).values({ ...values, kind: 'student' }).returning({ id: u.id, email: u.email, roomId: u.roomId })
          byEmail.set(row.email, row)
          created++
        }
      } catch (e) {
        errors.push({ row: offset + i + 2, message: isUniqueViolation(e) ? 'الرقم الجامعي مستخدم لطالب آخر' : 'تعذر الحفظ' })
      }
    }
    await logActivity(c, 'students.imported', { created, updated, errors: errors.length })
    return c.json({ created, updated, errors })
  })

/* ---------------- staff ---------------- */

const staffBody = z.object({
  name: z.string().trim().min(2, 'الاسم مطلوب').max(120),
  email,
  phone: optText(30),
  roleId: id.nullable().optional(),
  scopeBuildingIds: z.array(id).max(100).nullable().optional(),
})

async function loadStaff(actor: AuthUser, staffId: number) {
  const db = await getDb()
  const [s] = await db.select().from(u).where(and(eq(u.id, staffId), eq(u.kind, 'staff')))
  if (!s) fail(404, 'الموظف غير موجود')
  if (s.isSuper && !actor.isSuper) fail(403, 'لا يمكن تعديل حساب مدير النظام')
  return s
}

export const staffRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    requirePerm(c, 'staff.list', 'maintenance.assign')
    const db = await getDb()
    const rows = await db
      .select({
        id: u.id, name: u.name, email: u.email, phone: u.phone, roleId: u.roleId, isSuper: u.isSuper, status: u.status,
        activated: sql<boolean>`${u.passwordHash} is not null`, scopeBuildingIds: u.scopeBuildingIds, lastLoginAt: u.lastLoginAt,
      })
      .from(u)
      .where(eq(u.kind, 'staff'))
      .orderBy(sql`${u.isSuper} desc`, asc(u.name))
    return c.json(rows as StaffRow[])
  })

  .post('/', async (c) => {
    const actor = requirePerm(c, 'staff.create')
    const body = staffBody.parse(await c.req.json())
    await assertCanAssignRole(actor, body.roleId, 'staff')
    if (actor.scopeBuildingIds && (!body.scopeBuildingIds || body.scopeBuildingIds.some((b) => !actor.scopeBuildingIds!.includes(b))))
      fail(403, 'لا يمكنك منح نطاق مبانٍ أوسع من نطاقك')
    const db = await getDb()
    const [row] = await db.insert(u).values({ ...body, kind: 'staff' }).returning({ id: u.id }).catch(uniqueFail)
    await logActivity(c, 'staff.created', { userId: row.id, name: body.name })
    return c.json(row)
  })

  .patch('/:id', async (c) => {
    const actor = requirePerm(c, 'staff.edit')
    const sid = id.parse(c.req.param('id'))
    const target = await loadStaff(actor, sid)
    const body = staffBody.partial().extend({ status: z.enum(['active', 'suspended']).optional() }).parse(await c.req.json())
    if (target.isSuper && (body.status === 'suspended' || body.roleId !== undefined || body.scopeBuildingIds !== undefined))
      fail(400, 'حساب مدير النظام له كل الصلاحيات ولا يمكن إيقافه')
    if (sid === actor.id && (body.roleId !== undefined || body.status || body.scopeBuildingIds !== undefined)) fail(400, 'لا يمكنك تغيير صلاحياتك أو إيقاف حسابك')
    if (body.roleId !== undefined) await assertCanAssignRole(actor, body.roleId, 'staff')
    if (body.scopeBuildingIds !== undefined && actor.scopeBuildingIds && (!body.scopeBuildingIds || body.scopeBuildingIds.some((b) => !actor.scopeBuildingIds!.includes(b))))
      fail(403, 'لا يمكنك منح نطاق مبانٍ أوسع من نطاقك')
    const db = await getDb()
    await db.update(u).set(body).where(eq(u.id, sid)).catch(uniqueFail)
    if (body.status === 'suspended' || body.roleId !== undefined) await destroyUserSessions(sid)
    await logActivity(c, 'staff.updated', { userId: sid, fields: Object.keys(body) })
    return c.json({ ok: true })
  })

  .delete('/:id', async (c) => {
    const actor = requirePerm(c, 'staff.delete')
    const sid = id.parse(c.req.param('id'))
    const target = await loadStaff(actor, sid)
    if (target.isSuper || sid === actor.id) fail(400, 'لا يمكن حذف هذا الحساب')
    const db = await getDb()
    await db.delete(u).where(eq(u.id, sid))
    await logActivity(c, 'staff.deleted', { userId: sid, name: target.name })
    return c.json({ ok: true })
  })

  .post('/:id/send-link', async (c) => {
    const actor = requirePerm(c, 'staff.create', 'staff.edit')
    const target = await loadStaff(actor, id.parse(c.req.param('id')))
    return sendLinkTo(c, actor, target)
  })

/* ---------------- roles ---------------- */

const roleBody = z.object({
  nameAr: z.string().trim().min(2, 'اسم الصلاحية مطلوب').max(60),
  nameEn: z.string().trim().max(60).default(''),
  kind: z.enum(['staff', 'student']),
  permissions: z.array(z.string()).max(200),
})

export const roleRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    requirePerm(c, 'roles.list', 'staff.list', 'students.list')
    const db = await getDb()
    const rows = await db
      .select({
        id: schema.roles.id, nameAr: schema.roles.nameAr, nameEn: schema.roles.nameEn, kind: schema.roles.kind,
        isDefault: schema.roles.isDefault, permissions: schema.roles.permissions,
        userCount: sql<number>`(select count(*)::int from users where users.role_id = ${schema.roles.id})`,
      })
      .from(schema.roles)
      .orderBy(schema.roles.kind, schema.roles.id)
    return c.json(rows)
  })

  .post('/', async (c) => {
    const actor = requirePerm(c, 'roles.create')
    const body = roleBody.parse(await c.req.json())
    const permissions = body.permissions.filter((p) => permissionsFor(body.kind).includes(p))
    await assertCanGrant(actor, permissions)
    const db = await getDb()
    const [row] = await db.insert(schema.roles).values({ ...body, permissions }).returning({ id: schema.roles.id })
    await logActivity(c, 'roles.created', { roleId: row.id, name: body.nameAr })
    return c.json(row)
  })

  .patch('/:id', async (c) => {
    const actor = requirePerm(c, 'roles.edit')
    const rid = id.parse(c.req.param('id'))
    const db = await getDb()
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.id, rid))
    if (!role) fail(404, 'الصلاحية غير موجودة')
    const body = roleBody.omit({ kind: true }).partial().extend({ isDefault: z.literal(true).optional() }).parse(await c.req.json())
    const permissions = body.permissions?.filter((p) => permissionsFor(role.kind).includes(p))
    if (permissions) await assertCanGrant(actor, [...permissions, ...role.permissions])
    if (body.isDefault) {
      if (role.kind !== 'student') fail(400, 'الصلاحية الافتراضية للطلاب فقط')
      await db.update(schema.roles).set({ isDefault: false }).where(eq(schema.roles.kind, 'student'))
    }
    await db.update(schema.roles).set({ ...body, ...(permissions ? { permissions } : {}) }).where(eq(schema.roles.id, rid))
    await logActivity(c, 'roles.updated', { roleId: rid, name: body.nameAr ?? role.nameAr })
    return c.json({ ok: true })
  })

  .delete('/:id', async (c) => {
    const actor = requirePerm(c, 'roles.delete')
    const rid = id.parse(c.req.param('id'))
    const db = await getDb()
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.id, rid))
    if (!role) fail(404, 'الصلاحية غير موجودة')
    if (role.isDefault) fail(400, 'لا يمكن حذف صلاحية الطالب الافتراضية')
    await assertCanGrant(actor, role.permissions)
    await db.delete(schema.roles).where(eq(schema.roles.id, rid))
    await logActivity(c, 'roles.deleted', { roleId: rid, name: role.nameAr })
    return c.json({ ok: true })
  })
