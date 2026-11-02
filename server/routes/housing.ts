import { and, eq, inArray, max } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb, schema } from '../db/index.js'
import { fail, requirePerm, requireUser, type AppEnv } from '../auth.js'
import { logActivity } from '../common.js'
import { STANDARD_LAYOUT } from '../../shared/constants.js'

const READ_PERMS = ['housing.list', 'inspections.list', 'maintenance.list', 'students.list', 'results.view', 'staff.list']
const id = z.coerce.number().int().positive()

async function createStandardBuilding(name: string, sort: number) {
  const db = await getDb()
  const { floors, wingsPerFloor, firstWingRooms, otherWingRooms, roomCapacity } = STANDARD_LAYOUT
  const [b] = await db.insert(schema.buildings).values({ name, sort }).returning()
  const wingRows = Array.from({ length: floors * wingsPerFloor }, (_, i) => ({
    buildingId: b.id,
    number: i + 1,
    floor: Math.floor(i / wingsPerFloor) + 1,
  }))
  const ws = await db.insert(schema.wings).values(wingRows).returning()
  const roomRows = ws.flatMap((w) =>
    Array.from({ length: w.number === 1 ? firstWingRooms : otherWingRooms }, (_, k) => ({ wingId: w.id, number: k + 1, capacity: roomCapacity })),
  )
  await db.insert(schema.rooms).values(roomRows)
  return b
}

async function deleteInspectionsFor(type: 'room' | 'wing', ids: number[]) {
  if (!ids.length) return
  const db = await getDb()
  await db.delete(schema.inspections).where(and(eq(schema.inspections.targetType, type), inArray(schema.inspections.targetId, ids)))
}

export const housingRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const user = requireUser(c, 'staff')
    if (!user.isSuper && !READ_PERMS.some((p) => user.permissions.includes(p))) fail(403, 'غير مصرح')
    const db = await getDb()
    let [buildings, wings, rooms] = await Promise.all([
      db.select().from(schema.buildings).orderBy(schema.buildings.sort, schema.buildings.id),
      db.select().from(schema.wings).orderBy(schema.wings.number),
      db.select().from(schema.rooms).orderBy(schema.rooms.number),
    ])
    if (user.scopeBuildingIds) {
      const scope = new Set(user.scopeBuildingIds)
      buildings = buildings.filter((b) => scope.has(b.id))
      wings = wings.filter((w) => scope.has(w.buildingId))
      const wingIds = new Set(wings.map((w) => w.id))
      rooms = rooms.filter((r) => wingIds.has(r.wingId))
    }
    return c.json({ buildings, wings, rooms })
  })

  .post('/standard', async (c) => {
    requirePerm(c, 'housing.manage')
    const body = z.object({ count: z.number().int().min(1).max(50) }).parse(await c.req.json())
    const db = await getDb()
    const [{ m }] = await db.select({ m: max(schema.buildings.sort) }).from(schema.buildings)
    const start = (m ?? 0) + 1
    for (let i = 0; i < body.count; i++) await createStandardBuilding(`مبنى ${start + i}`, start + i)
    await logActivity(c, 'housing.standard_created', { count: body.count })
    return c.json({ ok: true })
  })

  .post('/buildings', async (c) => {
    requirePerm(c, 'housing.manage')
    const body = z.object({ name: z.string().trim().min(1).max(60), standard: z.boolean().default(true) }).parse(await c.req.json())
    const db = await getDb()
    const [{ m }] = await db.select({ m: max(schema.buildings.sort) }).from(schema.buildings)
    const b = body.standard
      ? await createStandardBuilding(body.name, (m ?? 0) + 1)
      : (await db.insert(schema.buildings).values({ name: body.name, sort: (m ?? 0) + 1 }).returning())[0]
    await logActivity(c, 'housing.building_created', { name: body.name })
    return c.json(b)
  })

  .patch('/buildings/:id', async (c) => {
    requirePerm(c, 'housing.manage')
    const body = z.object({ name: z.string().trim().min(1).max(60) }).parse(await c.req.json())
    const db = await getDb()
    await db.update(schema.buildings).set(body).where(eq(schema.buildings.id, id.parse(c.req.param('id'))))
    return c.json({ ok: true })
  })

  .delete('/buildings/:id', async (c) => {
    requirePerm(c, 'housing.manage')
    const bid = id.parse(c.req.param('id'))
    const db = await getDb()
    const ws = await db.select({ id: schema.wings.id }).from(schema.wings).where(eq(schema.wings.buildingId, bid))
    const wingIds = ws.map((w) => w.id)
    const rs = wingIds.length ? await db.select({ id: schema.rooms.id }).from(schema.rooms).where(inArray(schema.rooms.wingId, wingIds)) : []
    await deleteInspectionsFor('wing', wingIds)
    await deleteInspectionsFor('room', rs.map((r) => r.id))
    const [b] = await db.delete(schema.buildings).where(eq(schema.buildings.id, bid)).returning()
    await logActivity(c, 'housing.building_deleted', { name: b?.name })
    return c.json({ ok: true })
  })

  .post('/wings', async (c) => {
    requirePerm(c, 'housing.manage')
    const body = z
      .object({ buildingId: id, number: z.number().int().min(1).max(999), floor: z.number().int().min(0).max(50), rooms: z.number().int().min(0).max(50) })
      .parse(await c.req.json())
    const db = await getDb()
    const [w] = await db.insert(schema.wings).values({ buildingId: body.buildingId, number: body.number, floor: body.floor }).returning().catch(() => fail(409, 'رقم الجناح مستخدم في هذا المبنى'))
    if (body.rooms) await db.insert(schema.rooms).values(Array.from({ length: body.rooms }, (_, k) => ({ wingId: w.id, number: k + 1 })))
    await logActivity(c, 'housing.wing_created', { buildingId: body.buildingId, number: body.number })
    return c.json(w)
  })

  .patch('/wings/:id', async (c) => {
    requirePerm(c, 'housing.manage')
    const body = z.object({ number: z.number().int().min(1).max(999), floor: z.number().int().min(0).max(50) }).partial().parse(await c.req.json())
    const db = await getDb()
    await db.update(schema.wings).set(body).where(eq(schema.wings.id, id.parse(c.req.param('id')))).catch(() => fail(409, 'رقم الجناح مستخدم في هذا المبنى'))
    return c.json({ ok: true })
  })

  .delete('/wings/:id', async (c) => {
    requirePerm(c, 'housing.manage')
    const wid = id.parse(c.req.param('id'))
    const db = await getDb()
    const rs = await db.select({ id: schema.rooms.id }).from(schema.rooms).where(eq(schema.rooms.wingId, wid))
    await deleteInspectionsFor('wing', [wid])
    await deleteInspectionsFor('room', rs.map((r) => r.id))
    await db.delete(schema.wings).where(eq(schema.wings.id, wid))
    await logActivity(c, 'housing.wing_deleted', { wingId: wid })
    return c.json({ ok: true })
  })

  .post('/rooms', async (c) => {
    requirePerm(c, 'housing.manage')
    const body = z.object({ wingId: id, number: z.number().int().min(1).max(9999), capacity: z.number().int().min(1).max(10).default(2) }).parse(await c.req.json())
    const db = await getDb()
    const [r] = await db.insert(schema.rooms).values(body).returning().catch(() => fail(409, 'رقم الغرفة مستخدم في هذا الجناح'))
    return c.json(r)
  })

  .patch('/rooms/:id', async (c) => {
    requirePerm(c, 'housing.manage')
    const body = z.object({ number: z.number().int().min(1).max(9999), capacity: z.number().int().min(1).max(10) }).partial().parse(await c.req.json())
    const db = await getDb()
    await db.update(schema.rooms).set(body).where(eq(schema.rooms.id, id.parse(c.req.param('id')))).catch(() => fail(409, 'رقم الغرفة مستخدم في هذا الجناح'))
    return c.json({ ok: true })
  })

  .delete('/rooms/:id', async (c) => {
    requirePerm(c, 'housing.manage')
    const rid = id.parse(c.req.param('id'))
    const db = await getDb()
    await deleteInspectionsFor('room', [rid])
    await db.delete(schema.rooms).where(eq(schema.rooms.id, rid))
    await logActivity(c, 'housing.room_deleted', { roomId: rid })
    return c.json({ ok: true })
  })
