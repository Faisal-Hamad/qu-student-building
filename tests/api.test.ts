// End-to-end API tests against an in-memory PGlite database: `bun test`.
import { beforeAll, describe, expect, spyOn, test } from 'bun:test'

process.env.PGLITE_DIR = 'memory://'
const { mkdtempSync, existsSync, readdirSync } = await import('node:fs')
const UPLOADS = mkdtempSync(`${(await import('node:os')).tmpdir()}/sakan-test-`)
process.env.UPLOAD_DIR = UPLOADS
const { app } = await import('../server/app.js')

const ORIGIN = 'http://localhost'
type Jar = { cookie?: string }

async function call(jar: Jar, method: string, path: string, body?: unknown) {
  const res = await app.request(`${ORIGIN}/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'fetch',
      ...(jar.cookie ? { cookie: jar.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const set = res.headers.get('set-cookie')
  if (set) jar.cookie = set.split(';')[0]
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])

// Students file requests as multipart forms with photos.
async function fileRequest(jar: Jar, fields: Record<string, string>, photos: Uint8Array[] = [JPEG]) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  for (const p of photos) fd.append('photos', new File([p], 'p.jpg', { type: 'image/jpeg' }))
  const res = await app.request(`${ORIGIN}/api/maintenance`, {
    method: 'POST',
    headers: { 'x-requested-with': 'fetch', ...(jar.cookie ? { cookie: jar.cookie } : {}) },
    body: fd,
  })
  return { status: res.status, data: await res.json() }
}

// Captures emailed links from the dev mail logger.
const mails: string[] = []
spyOn(console, 'log').mockImplementation((...args: unknown[]) => void mails.push(args.join(' ')))
const lastToken = () => mails.at(-1)?.match(/token=([\w-]+)/)?.[1] ?? ''

const dean: Jar = {}
const sup: Jar = {}
const stu: Jar = {}
const stu2: Jar = {}
let studentId = 0
let supId = 0
let roomA = 0

beforeAll(async () => {
  const r = await call(dean, 'POST', '/setup', { token: 'dev', name: 'العميد', email: 'dean@qu.edu.sa', password: 'Dean-Pass-123' })
  expect(r.status).toBe(200)
})

describe('setup and auth', () => {
  test('setup cannot run twice', async () => {
    const r = await call({}, 'POST', '/setup', { token: 'dev', name: 'x x', email: 'x@x.com', password: 'Another-123' })
    expect(r.status).toBe(409)
  })

  test('dean is super admin with all staff permissions', async () => {
    const r = await call(dean, 'GET', '/auth/me')
    expect(r.data.isSuper).toBe(true)
    expect(r.data.permissions).toContain('roles.edit')
    expect(r.data.permissions).not.toContain('portal.maintenance_create')
  })

  test('requests without the fetch header are rejected (CSRF)', async () => {
    const res = await app.request(`${ORIGIN}/api/auth/login`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })
    expect(res.status).toBe(403)
  })

  test('wrong password gives a generic error', async () => {
    const r = await call({}, 'POST', '/auth/login', { email: 'dean@qu.edu.sa', password: 'nope-nope' })
    expect(r.status).toBe(401)
  })
})

describe('housing', () => {
  test('standard layout creates 94 rooms and 12 wings per building', async () => {
    expect((await call(dean, 'POST', '/housing/standard', { count: 2 })).status).toBe(200)
    const h = await call(dean, 'GET', '/housing')
    expect(h.data.buildings).toHaveLength(2)
    expect(h.data.wings).toHaveLength(24)
    expect(h.data.rooms).toHaveLength(188)
    const firstWing = h.data.wings.find((w: { number: number }) => w.number === 1)
    expect(h.data.rooms.filter((r: { wingId: number }) => r.wingId === firstWing.id)).toHaveLength(6)
    roomA = h.data.rooms.find((r: { wingId: number }) => r.wingId === firstWing.id).id
  })
})

describe('people and roles', () => {
  test('import students from Excel rows and activate by email', async () => {
    const r = await call(dean, 'POST', '/students/import', {
      rows: [
        { name: 'فهد العتيبي', email: 'fahad@qu.edu.sa', universityId: '441100', building: 'مبنى 1', wing: 1, room: 1 },
        { name: 'سعد الحربي', email: 'saad@qu.edu.sa', universityId: '441101', building: '1', wing: 1, room: 1 },
        { name: 'ثالث', email: 'third@qu.edu.sa', universityId: '441102', building: 'مبنى 1', wing: 1, room: 1 },
        { name: 'بدون', email: 'bad-email' },
      ],
    })
    expect(r.data.created).toBe(2)
    expect(r.data.errors.map((e: { message: string }) => e.message)).toContain('الغرفة ممتلئة')
    expect(r.data.errors).toHaveLength(2)

    // Student asks for an activation link; reply is generic either way.
    expect((await call({}, 'POST', '/auth/email-link', { email: 'nobody@qu.edu.sa' })).status).toBe(200)
    mails.length = 0
    expect((await call({}, 'POST', '/auth/email-link', { email: 'FAHAD@qu.edu.sa' })).status).toBe(200)
    const token = lastToken()
    expect(token.length).toBeGreaterThan(20)
    expect((await call({}, 'GET', `/auth/token-info?token=${token}`)).data.purpose).toBe('activate')
    expect((await call(stu, 'POST', '/auth/set-password', { token, password: 'short' })).status).toBe(400)
    expect((await call(stu, 'POST', '/auth/set-password', { token, password: 'Student-Pass-1' })).status).toBe(200)
    // The link is single-use.
    expect((await call({}, 'POST', '/auth/set-password', { token, password: 'Student-Pass-2' })).status).toBe(400)

    const me = await call(stu, 'GET', '/auth/me')
    expect(me.data.kind).toBe('student')
    expect(me.data.room.roomNumber).toBe(1)
    expect(me.data.permissions).toContain('portal.maintenance_create')
    studentId = me.data.id

    mails.length = 0
    await call({}, 'POST', '/auth/email-link', { email: 'saad@qu.edu.sa' })
    await call(stu2, 'POST', '/auth/set-password', { token: lastToken(), password: 'Student-Pass-3' })
  })

  test('students cannot reach staff endpoints', async () => {
    expect((await call(stu, 'GET', '/students')).status).toBe(403)
    expect((await call(stu, 'GET', '/housing')).status).toBe(403)
  })

  test('supervisor scoped to building 1 cannot escalate permissions', async () => {
    const roles = (await call(dean, 'GET', '/roles')).data
    const supRole = roles.find((r: { nameAr: string }) => r.nameAr === 'مشرف سكن')
    const h = (await call(dean, 'GET', '/housing')).data
    const b1 = h.buildings[0].id
    const created = await call(dean, 'POST', '/staff', { name: 'المشرف', email: 'sup@qu.edu.sa', roleId: supRole.id, scopeBuildingIds: [b1] })
    supId = created.data.id
    mails.length = 0
    await call(dean, 'POST', `/staff/${supId}/send-link`)
    await call(sup, 'POST', '/auth/set-password', { token: lastToken(), password: 'Super-Visor-1' })

    // Only sees building 1.
    expect((await call(sup, 'GET', '/housing')).data.buildings).toHaveLength(1)
    // Cannot create roles, cannot touch the dean.
    expect((await call(sup, 'POST', '/roles', { nameAr: 'كل شيء', kind: 'staff', permissions: ['roles.edit'] })).status).toBe(403)
    expect((await call(sup, 'GET', '/activity')).status).toBe(403)
  })

  test('dean can suspend and block a student', async () => {
    expect((await call(sup, 'PATCH', `/students/${studentId}/flags`, { requestsBlocked: true })).status).toBe(200)
    const r = await fileRequest(stu, { location: 'room', problemType: 'ac', description: 'المكيف لا يبرد' })
    expect(r.status).toBe(403)
    await call(sup, 'PATCH', `/students/${studentId}/flags`, { requestsBlocked: false })
  })
})

describe('maintenance rules', () => {
  let reqId = 0

  test('a photo is required and must be a real image', async () => {
    const none = await fileRequest(stu, { location: 'room', problemType: 'ac', description: 'المكيف لا يبرد' }, [])
    expect(none.status).toBe(400)
    const fake = await fileRequest(stu, { location: 'room', problemType: 'ac', description: 'المكيف لا يبرد' }, [new TextEncoder().encode('not an image')])
    expect(fake.data.error).toBe('الملف المرفق ليس صورة')
    const many = await fileRequest(stu, { location: 'room', problemType: 'ac', description: 'المكيف لا يبرد' }, [JPEG, JPEG, JPEG, JPEG])
    expect(many.status).toBe(400)
  })

  test('student files a request and staff get notified (rule 1)', async () => {
    const r = await fileRequest(stu, { location: 'room', problemType: 'ac', description: 'المكيف لا يبرد' }, [JPEG, JPEG])
    expect(r.status).toBe(200)
    expect(r.data.sr).toMatch(/^SR-\d{6}$/)
    reqId = r.data.id
    const n = await call(sup, 'GET', '/notifications')
    expect(n.data.unread).toBe(1)
    expect(n.data.rows[0].title).toContain(r.data.sr)
  })

  test('same problem while open is blocked with the SR number (rule 3)', async () => {
    const r = await fileRequest(stu, { location: 'room', problemType: 'ac', description: 'مرة ثانية' })
    expect(r.status).toBe(409)
    expect(r.data.error).toContain('SR-')
  })

  test('different problem type is allowed', async () => {
    const r = await fileRequest(stu, { location: 'bathroom', problemType: 'plumbing', description: 'تسريب في المغسلة' })
    expect(r.status).toBe(200)
  })

  test('after done, a repeat within 24 hours is still blocked (rule 2)', async () => {
    expect((await call(sup, 'PATCH', `/maintenance/${reqId}`, { status: 'done', note: 'تم تغيير الفلتر' })).status).toBe(200)
    const r = await fileRequest(stu, { location: 'room', problemType: 'ac', description: 'رجعت المشكلة' })
    expect(r.status).toBe(409)
    expect(r.data.error).toContain('24')
    // Student got an in-app update.
    expect((await call(stu, 'GET', '/notifications')).data.unread).toBe(1)
  })

  test('students only see their own requests', async () => {
    expect((await call(stu, 'GET', '/maintenance')).data.total).toBe(2)
    expect((await call(stu2, 'GET', '/maintenance')).data.total).toBe(0)
    expect((await call(stu2, 'GET', `/maintenance/${reqId}`)).status).toBe(404)
  })

  test('photos are private to the student and staff', async () => {
    const d = await call(stu, 'GET', `/maintenance/${reqId}`)
    expect(d.data.photos).toHaveLength(2)
    const url = `${ORIGIN}/api/maintenance/photos/${d.data.photos[0].id}`
    const own = await app.request(url, { headers: { cookie: stu.cookie! } })
    expect(own.status).toBe(200)
    expect(own.headers.get('content-type')).toBe('image/jpeg')
    expect(new Uint8Array(await own.arrayBuffer())).toEqual(JPEG)
    expect((await app.request(url, { headers: { cookie: stu2.cookie! } })).status).toBe(404)
    expect((await app.request(url)).status).toBe(401)
    expect((await app.request(url, { headers: { cookie: dean.cookie! } })).status).toBe(200)
  })

  test('request history records the status change', async () => {
    const r = await call(dean, 'GET', `/maintenance/${reqId}`)
    expect(r.data.events.map((e: { action: string }) => e.action)).toEqual(['created', 'status'])
  })
})

describe('deleting a request', () => {
  test('removes its stored photos', async () => {
    const r = await fileRequest(stu2, { location: 'kitchen', problemType: 'electric', description: 'فيش المطبخ لا يعمل' })
    expect(r.status).toBe(200)
    const dir = `${UPLOADS}/requests/${r.data.id}`
    expect(readdirSync(dir)).toHaveLength(1)
    expect((await call(dean, 'DELETE', `/maintenance/${r.data.id}`)).status).toBe(200)
    expect(existsSync(dir) ? readdirSync(dir) : []).toHaveLength(0)
  })
})

describe('inspections', () => {
  test('incomplete scoring is rejected, complete scoring is saved', async () => {
    expect((await call(sup, 'PUT', `/inspections/room/${roomA}`, { scores: { 'r-clean': 5 } })).status).toBe(400)
    const s = (await call(dean, 'GET', '/settings')).data
    const scores = Object.fromEntries(s.roomTemplate[0].criteria.map((c: { id: string }) => [c.id, 4]))
    expect((await call(sup, 'PUT', `/inspections/room/${roomA}`, { scores, notes: 'جيدة' })).status).toBe(200)
    expect((await call(dean, 'GET', '/inspections')).data).toHaveLength(1)
  })

  test('public results stay hidden until published', async () => {
    expect((await call({}, 'GET', '/public/results')).data.published).toBe(false)
    await call(dean, 'PUT', '/settings/publish', { publicResults: true })
    const r = await call({}, 'GET', '/public/results')
    expect(r.data.published).toBe(true)
    expect(r.data.rooms[0].name).toContain('غرفة 1')
  })
})

describe('sessions', () => {
  test('suspending a student ends their session', async () => {
    await call(dean, 'PATCH', `/students/${studentId}/flags`, { status: 'suspended' })
    expect((await call(stu, 'GET', '/auth/me')).data).toBeNull()
    const r = await call({}, 'POST', '/auth/login', { email: 'fahad@qu.edu.sa', password: 'Student-Pass-1' })
    expect(r.status).toBe(403)
  })
})
