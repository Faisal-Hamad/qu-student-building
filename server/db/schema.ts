import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull().default(''),
  kind: text('kind', { enum: ['staff', 'student'] }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  permissions: text('permissions').array().notNull().default(sql`'{}'::text[]`),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const buildings = pgTable('buildings', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sort: integer('sort').notNull().default(0),
})

export const wings = pgTable(
  'wings',
  {
    id: serial('id').primaryKey(),
    buildingId: integer('building_id').notNull().references(() => buildings.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    floor: integer('floor').notNull().default(1),
  },
  (t) => [uniqueIndex('wings_building_number').on(t.buildingId, t.number)],
)

export const rooms = pgTable(
  'rooms',
  {
    id: serial('id').primaryKey(),
    wingId: integer('wing_id').notNull().references(() => wings.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    capacity: integer('capacity').notNull().default(2),
  },
  (t) => [uniqueIndex('rooms_wing_number').on(t.wingId, t.number)],
)

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    kind: text('kind', { enum: ['staff', 'student'] }).notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    universityId: text('university_id'),
    phone: text('phone'),
    passwordHash: text('password_hash'),
    roleId: integer('role_id').references(() => roles.id, { onDelete: 'set null' }),
    isSuper: boolean('is_super').notNull().default(false),
    status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
    requestsBlocked: boolean('requests_blocked').notNull().default(false),
    roomId: integer('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    // null = all buildings; otherwise the staff member only sees these buildings.
    scopeBuildingIds: integer('scope_building_ids').array(),
    createdAt: ts('created_at').notNull().defaultNow(),
    activatedAt: ts('activated_at'),
    lastLoginAt: ts('last_login_at'),
  },
  (t) => [
    uniqueIndex('users_email').on(sql`lower(${t.email})`),
    uniqueIndex('users_university_id').on(t.universityId),
    index('users_room').on(t.roomId),
  ],
)

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // sha256 of the cookie token
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  ip: text('ip'),
  userAgent: text('user_agent'),
})

export const authTokens = pgTable('auth_tokens', {
  id: text('id').primaryKey(), // sha256 of the emailed token
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose', { enum: ['activate', 'reset'] }).notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: ts('window_start').notNull().defaultNow(),
})

export const maintenanceRequests = pgTable(
  'maintenance_requests',
  {
    id: serial('id').primaryKey(),
    sr: text('sr').generatedAlwaysAs(sql`'SR-' || lpad(id::text, 6, '0')`),
    studentId: integer('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    roomId: integer('room_id').references(() => rooms.id, { onDelete: 'set null' }),
    // Snapshot so the request still reads correctly if the housing layout changes later.
    locationLabel: text('location_label').notNull(),
    location: text('location', { enum: ['room', 'kitchen', 'lounge', 'bathroom', 'showers'] }).notNull(),
    problemType: text('problem_type', { enum: ['furniture', 'ac', 'plumbing', 'electric', 'other'] }).notNull(),
    description: text('description').notNull(),
    status: text('status', { enum: ['new', 'in_progress', 'done', 'rejected'] }).notNull().default('new'),
    assignedTo: integer('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    completedAt: ts('completed_at'),
  },
  (t) => [
    index('mr_status').on(t.status),
    index('mr_student').on(t.studentId),
    // Rule 3: one open request per student + room + problem type; enforced by the database as well as the API.
    uniqueIndex('mr_one_open')
      .on(t.studentId, t.roomId, t.problemType)
      .where(sql`status in ('new', 'in_progress')`),
  ],
)

export const maintenanceEvents = pgTable(
  'maintenance_events',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').notNull().references(() => maintenanceRequests.id, { onDelete: 'cascade' }),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action', { enum: ['created', 'status', 'assigned', 'note'] }).notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    note: text('note'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('me_request').on(t.requestId)],
)

export const inspections = pgTable(
  'inspections',
  {
    id: serial('id').primaryKey(),
    round: integer('round').notNull(),
    targetType: text('target_type', { enum: ['room', 'wing'] }).notNull(),
    targetId: integer('target_id').notNull(),
    scores: jsonb('scores').$type<Record<string, number>>().notNull(),
    notes: text('notes').notNull().default(''),
    disqualified: boolean('disqualified').notNull().default(false),
    disqualifyReason: text('disqualify_reason').notNull().default(''),
    inspectorId: integer('inspector_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('inspections_target').on(t.round, t.targetType, t.targetId)],
)

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
})

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    link: text('link'),
    readAt: ts('read_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user').on(t.userId, t.readAt)],
)

export const activityLog = pgTable(
  'activity_log',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('activity_created').on(t.createdAt)],
)
