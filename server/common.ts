import { and, eq, isNull, or, sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { getDb, schema } from './db/index.js'
import { clientIp, type AppEnv } from './auth.js'
import { defaultSettings } from '../shared/scoring.js'
import type { Settings } from '../shared/types.js'

export async function logActivity(c: Context<AppEnv>, action: string, details?: Record<string, unknown>) {
  const db = await getDb()
  await db.insert(schema.activityLog).values({ actorId: c.get('user')?.id ?? null, action, details: details ?? null, ip: clientIp(c) })
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb()
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'app'))
  return { ...defaultSettings(), ...((row?.value as Partial<Settings>) ?? {}) }
}

export async function saveSettings(s: Settings) {
  const db = await getDb()
  await db
    .insert(schema.settings)
    .values({ key: 'app', value: s })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: s } })
}

// Staff who should hear about a request: they hold the permission (via role or super) and the building is in their scope.
export async function notifyStaff(permission: string, buildingId: number | null, n: { title: string; body: string; link: string }) {
  const db = await getDb()
  const u = schema.users
  const recipients = await db
    .select({ id: u.id })
    .from(u)
    .leftJoin(schema.roles, eq(schema.roles.id, u.roleId))
    .where(
      and(
        eq(u.kind, 'staff'),
        eq(u.status, 'active'),
        or(eq(u.isSuper, true), sql`${permission} = any(${schema.roles.permissions})`),
        buildingId == null ? sql`true` : or(isNull(u.scopeBuildingIds), sql`${buildingId}::int = any(${u.scopeBuildingIds})`),
      ),
    )
  if (recipients.length) await db.insert(schema.notifications).values(recipients.map((r) => ({ userId: r.id, ...n })))
}

export async function notifyUser(userId: number, n: { title: string; body: string; link: string }) {
  const db = await getDb()
  await db.insert(schema.notifications).values({ userId, ...n })
}

export async function roomContext(roomId: number) {
  const db = await getDb()
  const [row] = await db
    .select({ roomNumber: schema.rooms.number, wingId: schema.wings.id, wingNumber: schema.wings.number, buildingId: schema.buildings.id, buildingName: schema.buildings.name })
    .from(schema.rooms)
    .innerJoin(schema.wings, eq(schema.wings.id, schema.rooms.wingId))
    .innerJoin(schema.buildings, eq(schema.buildings.id, schema.wings.buildingId))
    .where(eq(schema.rooms.id, roomId))
  return row
}

export async function buildingOfTarget(type: 'room' | 'wing', id: number) {
  const db = await getDb()
  if (type === 'wing') {
    const [w] = await db.select({ b: schema.wings.buildingId }).from(schema.wings).where(eq(schema.wings.id, id))
    return w?.b
  }
  return (await roomContext(id))?.buildingId
}

