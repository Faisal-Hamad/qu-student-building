import { and, count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb, schema } from '../db/index.js'
import { can, fail, inScope, requirePerm, requireUser, type AppEnv } from '../auth.js'
import { buildingOfTarget, getSettings, logActivity, saveSettings } from '../common.js'
import { mailConfigured } from '../mail.js'
import { storageConfigured } from '../storage.js'
import { rankings } from '../../shared/scoring.js'
import type { Housing, Inspection, PublicResults, Section } from '../../shared/types.js'

const i = schema.inspections
const targetType = z.enum(['room', 'wing'])
const id = z.coerce.number().int().positive()

async function loadRound(round: number): Promise<Inspection[]> {
  const db = await getDb()
  const rows = await db
    .select({
      id: i.id, round: i.round, targetType: i.targetType, targetId: i.targetId, scores: i.scores, notes: i.notes,
      disqualified: i.disqualified, disqualifyReason: i.disqualifyReason, inspectorId: i.inspectorId,
      inspectorName: schema.users.name, createdAt: i.createdAt, updatedAt: i.updatedAt,
    })
    .from(i)
    .leftJoin(schema.users, eq(schema.users.id, i.inspectorId))
    .where(eq(i.round, round))
  return rows
}

async function loadHousing(): Promise<Housing> {
  const db = await getDb()
  const [buildings, wings, rooms] = await Promise.all([
    db.select().from(schema.buildings),
    db.select().from(schema.wings),
    db.select().from(schema.rooms),
  ])
  return { buildings, wings, rooms }
}

const sectionSchema = z.array(
  z.object({
    id: z.string().min(1).max(40),
    label: z.string().trim().min(1).max(80),
    criteria: z.array(z.object({ id: z.string().min(1).max(40), label: z.string().trim().min(1).max(200), weight: z.number().int().min(1).max(5) })).max(40),
  }),
).max(12)

export const inspectionRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const user = requirePerm(c, 'inspections.list', 'results.view')
    const settings = await getSettings()
    const round = Number(c.req.query('round') ?? settings.currentRound)
    let rows = await loadRound(round)
    if (user.scopeBuildingIds) {
      const h = await loadHousing()
      const wingB = new Map(h.wings.map((w) => [w.id, w.buildingId]))
      const roomB = new Map(h.rooms.map((r) => [r.id, wingB.get(r.wingId)]))
      rows = rows.filter((r) => inScope(user, r.targetType === 'wing' ? wingB.get(r.targetId) : roomB.get(r.targetId)))
    }
    return c.json(rows)
  })

  .put('/:type/:targetId', async (c) => {
    const user = requirePerm(c, 'inspections.inspect')
    const type = targetType.parse(c.req.param('type'))
    const targetId = id.parse(c.req.param('targetId'))
    const buildingId = await buildingOfTarget(type, targetId)
    if (!buildingId) fail(404, 'الوحدة غير موجودة')
    if (!inScope(user, buildingId)) fail(403, 'الوحدة خارج نطاق مبانيك')

    const settings = await getSettings()
    const tpl: Section[] = type === 'room' ? settings.roomTemplate : settings.wingTemplate
    const criteria = tpl.flatMap((s) => s.criteria.map((cr) => cr.id))
    const body = z
      .object({
        scores: z.record(z.number().int().min(0).max(settings.maxScore)),
        notes: z.string().trim().max(2000).default(''),
        disqualified: z.boolean().default(false),
        disqualifyReason: z.string().trim().max(500).default(''),
      })
      .parse(await c.req.json())
    const scores = Object.fromEntries(Object.entries(body.scores).filter(([k]) => criteria.includes(k)))
    if (criteria.some((k) => scores[k] === undefined)) fail(400, 'أكمل تقييم جميع المعايير')
    if (body.disqualified && !body.disqualifyReason) fail(400, 'اكتب سبب الاستبعاد')

    const db = await getDb()
    const values = { ...body, scores, disqualifyReason: body.disqualified ? body.disqualifyReason : '', inspectorId: user.id }
    await db
      .insert(i)
      .values({ round: settings.currentRound, targetType: type, targetId, ...values })
      .onConflictDoUpdate({ target: [i.round, i.targetType, i.targetId], set: { ...values, updatedAt: new Date().toISOString() } })
    await logActivity(c, 'inspections.saved', { type, targetId, round: settings.currentRound, disqualified: body.disqualified })
    return c.json({ ok: true })
  })

  .delete('/:type/:targetId', async (c) => {
    const user = requirePerm(c, 'inspections.delete')
    const type = targetType.parse(c.req.param('type'))
    const targetId = id.parse(c.req.param('targetId'))
    if (!inScope(user, await buildingOfTarget(type, targetId))) fail(403, 'الوحدة خارج نطاق مبانيك')
    const settings = await getSettings()
    const db = await getDb()
    await db.delete(i).where(and(eq(i.round, settings.currentRound), eq(i.targetType, type), eq(i.targetId, targetId)))
    await logActivity(c, 'inspections.deleted', { type, targetId })
    return c.json({ ok: true })
  })

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    requireUser(c, 'staff')
    const db = await getDb()
    const [usage] = await db.select({ bytes: sql<number>`coalesce(sum(${schema.maintenancePhotos.size}), 0)::bigint`, n: count() }).from(schema.maintenancePhotos)
    return c.json({
      ...(await getSettings()),
      mailConfigured: mailConfigured(),
      storageConfigured: storageConfigured(),
      photoBytes: Number(usage.bytes),
      photoCount: usage.n,
    })
  })
  .put('/criteria', async (c) => {
    requirePerm(c, 'inspections.criteria')
    const body = z.object({ roomTemplate: sectionSchema, wingTemplate: sectionSchema }).parse(await c.req.json())
    await saveSettings({ ...(await getSettings()), ...body })
    await logActivity(c, 'settings.criteria')
    return c.json({ ok: true })
  })
  .put('/prizes', async (c) => {
    requirePerm(c, 'settings.manage')
    const n = z.number().int().min(0).max(1_000_000)
    const body = z
      .object({ roomPrizeCount: n, roomPrizeAmount: n, wingPrizeCount: n, wingPrizeAmount: n, backupEmail: z.union([z.literal(''), z.string().email()]), photoRetentionMonths: z.number().int().min(0).max(120) })
      .partial()
      .parse(await c.req.json())
    await saveSettings({ ...(await getSettings()), ...body })
    await logActivity(c, 'settings.updated', body)
    return c.json({ ok: true })
  })
  .put('/publish', async (c) => {
    requirePerm(c, 'results.publish')
    const { publicResults } = z.object({ publicResults: z.boolean() }).parse(await c.req.json())
    await saveSettings({ ...(await getSettings()), publicResults })
    await logActivity(c, publicResults ? 'results.published' : 'results.unpublished')
    return c.json({ ok: true })
  })
  .post('/new-round', async (c) => {
    requirePerm(c, 'settings.manage')
    const s = await getSettings()
    await saveSettings({ ...s, currentRound: s.currentRound + 1, publicResults: false })
    await logActivity(c, 'inspections.new_round', { round: s.currentRound + 1 })
    return c.json({ ok: true, round: s.currentRound + 1 })
  })

// Winners only: no scores of other units and no student names.
export const publicRoutes = new Hono<AppEnv>().get('/results', async (c) => {
  const s = await getSettings()
  const empty: PublicResults = { published: false, roomPrizeAmount: s.roomPrizeAmount, wingPrizeAmount: s.wingPrizeAmount, rooms: [], wings: [] }
  if (!s.publicResults) return c.json(empty)
  const [h, insp] = await Promise.all([loadHousing(), loadRound(s.currentRound)])
  const pick = (type: 'room' | 'wing') =>
    rankings(h, insp, s, type)
      .filter((r) => r.winner || r.tiedAtCutoff)
      .map((r) => ({ rank: r.rank!, name: r.name, location: r.location, tied: r.tiedAtCutoff }))
  return c.json({ ...empty, published: true, rooms: pick('room'), wings: pick('wing') } satisfies PublicResults)
})

// A student's own room and wing results for the current round.
export const myInspectionRoute = new Hono<AppEnv>().get('/', async (c) => {
  const user = requireUser(c, 'student')
  if (!can(user, 'portal.inspection_view')) fail(403, 'غير مصرح')
  const s = await getSettings()
  if (!user.room) return c.json({ room: null, wing: null, settings: null })
  const db = await getDb()
  const rows = await db.select().from(i).where(eq(i.round, s.currentRound))
  const pick = (type: 'room' | 'wing', tid: number) => {
    const r = rows.find((x) => x.targetType === type && x.targetId === tid)
    return r ? { scores: r.scores, notes: r.notes, disqualified: r.disqualified, disqualifyReason: r.disqualifyReason, updatedAt: r.updatedAt } : null
  }
  return c.json({
    room: pick('room', user.room.roomId),
    wing: pick('wing', user.room.wingId),
    settings: { maxScore: s.maxScore, roomTemplate: s.roomTemplate, wingTemplate: s.wingTemplate },
  })
})
