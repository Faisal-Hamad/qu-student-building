import type { DB, Inspection, Section } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const c = (id: string, label: string, weight = 1) => ({ id, label, weight })

export const defaultRoomTemplate = (): Section[] => [
  {
    id: 'room',
    label: 'الغرفة',
    criteria: [
      c('r-clean', 'النظافة العامة للغرفة', 2),
      c('r-floor', 'نظافة الأرضية'),
      c('r-bed', 'ترتيب الأسرّة والمفارش'),
      c('r-closet', 'ترتيب الدواليب والملابس'),
      c('r-desk', 'ترتيب المكاتب والأدراج'),
      c('r-smell', 'الرائحة والتهوية'),
      c('r-trash', 'التخلص من النفايات'),
      c('r-property', 'المحافظة على الممتلكات (جدران، أبواب، إضاءة)'),
    ],
  },
]

export const defaultWingTemplate = (): Section[] => [
  {
    id: 'kitchen',
    label: 'المطبخ',
    criteria: [
      c('k-surfaces', 'نظافة الأسطح والرخام'),
      c('k-sink', 'نظافة المغسلة وعدم تراكم الأواني'),
      c('k-fridge', 'نظافة الثلاجة وخلوها من الأطعمة التالفة'),
      c('k-stove', 'نظافة الموقد والميكرويف'),
      c('k-floor', 'نظافة الأرضية'),
      c('k-trash', 'التخلص من النفايات'),
    ],
  },
  {
    id: 'lounge',
    label: 'الصالة',
    criteria: [
      c('l-tidy', 'الترتيب العام'),
      c('l-furniture', 'نظافة الأثاث والكنب'),
      c('l-floor', 'نظافة الأرضية والسجاد'),
      c('l-property', 'المحافظة على الممتلكات'),
    ],
  },
  {
    id: 'toilets',
    label: 'دورة المياه',
    criteria: [
      c('t-toilet', 'نظافة المراحيض', 2),
      c('t-basin', 'نظافة المغاسل والمرايا'),
      c('t-floor', 'نظافة الأرضية وجفافها'),
      c('t-smell', 'الرائحة والتهوية'),
    ],
  },
  {
    id: 'showers',
    label: 'المراوش',
    criteria: [
      c('s-clean', 'نظافة الأرضيات والجدران', 2),
      c('s-drain', 'سلامة تصريف المياه'),
      c('s-items', 'عدم ترك الأغراض الشخصية'),
    ],
  },
]

const FIRST = ['عبدالله', 'محمد', 'فهد', 'خالد', 'سعود', 'تركي', 'نايف', 'فيصل', 'عبدالرحمن', 'سلطان', 'ماجد', 'بندر', 'راكان', 'يزيد', 'مشعل', 'عمر', 'حمد', 'سلمان', 'ريان', 'أنس']
const LAST = ['العتيبي', 'القحطاني', 'الشهري', 'الدوسري', 'الغامدي', 'الحربي', 'المطيري', 'الزهراني', 'العنزي', 'الشمري', 'السبيعي', 'الرشيدي', 'البقمي', 'الأحمدي', 'الخالدي']

// Deterministic PRNG so the demo looks the same on every device.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function emptyDB(): DB {
  return {
    version: 1,
    buildings: [],
    wings: [],
    rooms: [],
    members: [{ id: 'dean', name: 'عميد شؤون الطلاب', role: 'admin' }],
    roomTemplate: defaultRoomTemplate(),
    wingTemplate: defaultWingTemplate(),
    inspections: [],
    settings: {
      maxScore: 5,
      roomPrizeCount: 6,
      roomPrizeAmount: 500,
      wingPrizeCount: 3,
      wingPrizeAmount: 1000,
      publicResults: true,
    },
  }
}

export function demoDB(): DB {
  const db = emptyDB()
  const rand = mulberry32(1447)
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]

  db.members.push(
    { id: 'm1', name: 'أ. سعد الحربي', role: 'inspector' },
    { id: 'm2', name: 'أ. ناصر الدوسري', role: 'inspector' },
    { id: 'm3', name: 'أ. ماجد الشهري', role: 'inspector' },
    { id: 'm4', name: 'أ. حسن الغامدي', role: 'inspector' },
  )

  const buildingNames = ['مبنى أ', 'مبنى ب']
  buildingNames.forEach((bn, bi) => {
    const b = { id: `b${bi + 1}`, name: bn }
    db.buildings.push(b)
    for (let w = 1; w <= 6; w++) {
      const wingName = `${bi + 1}0${w}`
      const wing = { id: `w${wingName}`, buildingId: b.id, name: wingName }
      db.wings.push(wing)
      for (let r = 1; r <= 5; r++) {
        db.rooms.push({
          id: `r${wingName}-${r}`,
          wingId: wing.id,
          name: String(r),
          students: [`${pick(FIRST)} ${pick(LAST)}`, `${pick(FIRST)} ${pick(LAST)}`],
        })
      }
    }
  })

  const inspectors = db.members.filter((m) => m.role === 'inspector')
  const day = (d: number) => new Date(Date.UTC(2026, 9, 18 + d, 7 + Math.floor(rand() * 6), Math.floor(rand() * 60))).toISOString()

  const makeInspection = (targetType: 'room' | 'wing', targetId: string, tpl: Section[], quality: number): Inspection => {
    const scores: Record<string, number> = {}
    for (const s of tpl) for (const cr of s.criteria) {
      const v = Math.round(quality * 5 + (rand() - 0.5) * 2.2)
      scores[cr.id] = Math.max(0, Math.min(5, v))
    }
    const t = day(Math.floor(rand() * 5))
    return {
      id: uid(), targetType, targetId, scores, notes: '', disqualified: false, disqualifyReason: '',
      photos: [], inspectorId: pick(inspectors).id, createdAt: t, updatedAt: t,
    }
  }

  const roomNotes = ['الغرفة مرتبة بشكل ممتاز', 'يوجد ملابس على الأرض', 'تحتاج تهوية', 'المكاتب غير مرتبة', 'نظافة ممتازة والتزام واضح']
  db.rooms.forEach((r, i) => {
    if (i % 6 === 5) return // leave some rooms un-inspected
    const insp = makeInspection('room', r.id, db.roomTemplate, 0.45 + rand() * 0.5)
    if (rand() < 0.35) insp.notes = pick(roomNotes)
    db.inspections.push(insp)
  })

  // A demo violation, and a tie at the prize cutoff so the committee-decision flow is visible.
  const dq = db.inspections.find((i) => i.targetId === 'r203-2')
  if (dq) Object.assign(dq, { disqualified: true, disqualifyReason: 'وجود أجهزة طبخ كهربائية ممنوعة داخل الغرفة' })

  const wingNotes = ['المطبخ يحتاج عناية أكثر', 'المراوش نظيفة جداً', 'الصالة مرتبة', 'تسريب بسيط في أحد المراوش — تم إبلاغ الصيانة']
  db.wings.forEach((w, i) => {
    if (i === 4 || i === 10) return
    const insp = makeInspection('wing', w.id, db.wingTemplate, 0.5 + rand() * 0.45)
    if (rand() < 0.5) insp.notes = pick(wingNotes)
    db.inspections.push(insp)
  })

  return withCutoffTie(db)
}

// Spreads apart accidental ties near the top, then copies the last winning room's scores onto the
// next room so the demo shows exactly one tie at the prize cutoff.
function withCutoffTie(db: DB): DB {
  const spread = (tpl: Section[], list: Inspection[]) => {
    const crit = tpl.flatMap((s) => s.criteria)
    const max = db.settings.maxScore * crit.reduce((a, c) => a + c.weight, 0)
    const pct = (i: Inspection) => Math.round((crit.reduce((a, c) => a + (i.scores[c.id] ?? 0) * c.weight, 0) / max) * 1000)
    list.sort((a, b) => pct(b) - pct(a))
    const lower = (insp: Inspection, until: (p: number) => boolean) => {
      for (let k = 0; !until(pct(insp)) && pct(insp) > 0; k++) {
        const c = crit[k % crit.length]
        if (insp.scores[c.id] > 0) insp.scores[c.id] -= 1
      }
    }
    const used = new Set<number>()
    const top = list.slice(0, 8)
    for (const insp of top) {
      lower(insp, (p) => !used.has(p))
      used.add(pct(insp))
    }
    const floor = Math.min(...used)
    for (const insp of list.slice(8)) lower(insp, (p) => p < floor)
    list.sort((a, b) => pct(b) - pct(a))
  }
  const rooms = db.inspections.filter((i) => i.targetType === 'room' && !i.disqualified)
  const wings = db.inspections.filter((i) => i.targetType === 'wing')
  spread(db.roomTemplate, rooms)
  spread(db.wingTemplate, wings)
  const n = db.settings.roomPrizeCount
  if (rooms.length > n) rooms[n].scores = { ...rooms[n - 1].scores }
  return db
}
