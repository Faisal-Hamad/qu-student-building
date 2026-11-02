import type { Housing, Inspection, Section, Settings, TargetType } from './types.js'

export interface ScoreResult {
  percent: number
  complete: boolean
  sections: { id: string; label: string; percent: number | null }[]
}

export const round1 = (n: number) => Math.round(n * 10) / 10

export function scoreInspection(templates: Section[], scores: Record<string, number>, maxScore: number): ScoreResult {
  let got = 0
  let max = 0
  let complete = true
  const sections = templates.map((s) => {
    let sGot = 0
    let sMax = 0
    for (const c of s.criteria) {
      const v = scores[c.id]
      if (v === undefined) {
        complete = false
        continue
      }
      sGot += v * c.weight
      sMax += maxScore * c.weight
    }
    got += sGot
    max += sMax
    return { id: s.id, label: s.label, percent: sMax ? (sGot / sMax) * 100 : null }
  })
  return { percent: max ? (got / max) * 100 : 0, complete, sections }
}

export interface RankRow {
  targetId: number
  name: string
  location: string
  buildingId: number
  inspection?: Inspection
  score?: ScoreResult
  status: 'pending' | 'disqualified' | 'ranked'
  rank?: number
  winner: boolean
  tiedAtCutoff: boolean
}

export function unitLabels(h: Housing) {
  const wingById = new Map(h.wings.map((w) => [w.id, w]))
  const bById = new Map(h.buildings.map((b) => [b.id, b]))
  return {
    wingById,
    bById,
    room: (roomId: number) => {
      const r = h.rooms.find((x) => x.id === roomId)
      const w = r && wingById.get(r.wingId)
      const b = w && bById.get(w.buildingId)
      return { name: `غرفة ${r?.number ?? '?'} · جناح ${w?.number ?? '?'}`, location: b?.name ?? '', buildingId: b?.id ?? 0 }
    },
    wing: (wingId: number) => {
      const w = wingById.get(wingId)
      const b = w && bById.get(w.buildingId)
      return { name: `جناح ${w?.number ?? '?'}`, location: b?.name ?? '', buildingId: b?.id ?? 0 }
    },
  }
}

export function rankings(h: Housing, inspections: Inspection[], settings: Settings, type: TargetType): RankRow[] {
  const tpl = type === 'room' ? settings.roomTemplate : settings.wingTemplate
  const prizeCount = type === 'room' ? settings.roomPrizeCount : settings.wingPrizeCount
  const labels = unitLabels(h)
  const byTarget = new Map(inspections.filter((i) => i.targetType === type).map((i) => [i.targetId, i]))
  const ids = type === 'room' ? h.rooms.map((r) => r.id) : h.wings.map((w) => w.id)

  const rows: RankRow[] = ids.map((id) => {
    const l = type === 'room' ? labels.room(id) : labels.wing(id)
    const inspection = byTarget.get(id)
    const score = inspection ? scoreInspection(tpl, inspection.scores, settings.maxScore) : undefined
    const status = !inspection ? 'pending' : inspection.disqualified ? 'disqualified' : 'ranked'
    return { targetId: id, ...l, inspection, score, status, winner: false, tiedAtCutoff: false }
  })

  const ranked = rows.filter((r) => r.status === 'ranked').sort((a, b) => b.score!.percent - a.score!.percent)

  // Competition ranking on the rounded score shown to users, so equal displayed scores share a rank.
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1]
    r.rank = prev && round1(prev.score!.percent) === round1(r.score!.percent) ? prev.rank : i + 1
  })

  if (ranked.length > prizeCount && prizeCount > 0) {
    const cutoff = round1(ranked[prizeCount - 1].score!.percent)
    const tieAcross = round1(ranked[prizeCount].score!.percent) === cutoff
    for (const r of ranked) {
      const p = round1(r.score!.percent)
      if (p > cutoff || (p === cutoff && !tieAcross)) r.winner = true
      if (tieAcross && p === cutoff) r.tiedAtCutoff = true
    }
  } else {
    ranked.slice(0, prizeCount).forEach((r) => (r.winner = true))
  }

  const rest = rows.filter((r) => r.status !== 'ranked')
  return [...ranked, ...rest.sort((a, b) => (a.status === b.status ? 0 : a.status === 'disqualified' ? -1 : 1))]
}

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
    criteria: [c('l-tidy', 'الترتيب العام'), c('l-furniture', 'نظافة الأثاث والكنب'), c('l-floor', 'نظافة الأرضية والسجاد'), c('l-property', 'المحافظة على الممتلكات')],
  },
  {
    id: 'toilets',
    label: 'دورة المياه',
    criteria: [c('t-toilet', 'نظافة المراحيض', 2), c('t-basin', 'نظافة المغاسل والمرايا'), c('t-floor', 'نظافة الأرضية وجفافها'), c('t-smell', 'الرائحة والتهوية')],
  },
  {
    id: 'showers',
    label: 'المراوش',
    criteria: [c('s-clean', 'نظافة الأرضيات والجدران', 2), c('s-drain', 'سلامة تصريف المياه'), c('s-items', 'عدم ترك الأغراض الشخصية')],
  },
]

export const defaultSettings = (): Settings => ({
  maxScore: 5,
  roomPrizeCount: 6,
  roomPrizeAmount: 500,
  wingPrizeCount: 3,
  wingPrizeAmount: 1000,
  publicResults: false,
  currentRound: 1,
  backupEmail: '',
  photoRetentionMonths: 0,
  roomTemplate: defaultRoomTemplate(),
  wingTemplate: defaultWingTemplate(),
})
