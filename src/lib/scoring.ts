import type { DB, Inspection, Section, TargetType } from './types'

export interface ScoreResult {
  percent: number
  complete: boolean
  sections: { id: string; label: string; percent: number | null }[]
}

export function scoreInspection(templates: Section[], insp: Inspection, maxScore: number): ScoreResult {
  let got = 0
  let max = 0
  let complete = true
  const sections = templates.map((s) => {
    let sGot = 0
    let sMax = 0
    for (const c of s.criteria) {
      const v = insp.scores[c.id]
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
  targetId: string
  name: string
  location: string
  inspection?: Inspection
  score?: ScoreResult
  status: 'pending' | 'disqualified' | 'ranked'
  rank?: number
  winner: boolean
  tiedAtCutoff: boolean
}

export const round1 = (n: number) => Math.round(n * 10) / 10

export function latestInspection(db: DB, type: TargetType, id: string) {
  return db.inspections.find((i) => i.targetType === type && i.targetId === id)
}

export function rankings(db: DB, type: TargetType): RankRow[] {
  const tpl = type === 'room' ? db.roomTemplate : db.wingTemplate
  const prizeCount = type === 'room' ? db.settings.roomPrizeCount : db.settings.wingPrizeCount
  const wingById = new Map(db.wings.map((w) => [w.id, w]))
  const bById = new Map(db.buildings.map((b) => [b.id, b]))

  const units =
    type === 'room'
      ? db.rooms.map((r) => {
          const w = wingById.get(r.wingId)
          return { id: r.id, name: `غرفة ${r.name} · جناح ${w?.name ?? ''}`, location: bById.get(w?.buildingId ?? '')?.name ?? '' }
        })
      : db.wings.map((w) => ({ id: w.id, name: `جناح ${w.name}`, location: bById.get(w.buildingId)?.name ?? '' }))

  const rows: RankRow[] = units.map((u) => {
    const inspection = latestInspection(db, type, u.id)
    const score = inspection ? scoreInspection(tpl, inspection, db.settings.maxScore) : undefined
    const status = !inspection ? 'pending' : inspection.disqualified ? 'disqualified' : 'ranked'
    return { targetId: u.id, name: u.name, location: u.location, inspection, score, status, winner: false, tiedAtCutoff: false }
  })

  const ranked = rows
    .filter((r) => r.status === 'ranked')
    .sort((a, b) => b.score!.percent - a.score!.percent)

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

export function scoreTone(p: number) {
  if (p >= 85) return 'text-emerald-700 bg-emerald-50 ring-emerald-200'
  if (p >= 70) return 'text-teal-700 bg-teal-50 ring-teal-200'
  if (p >= 50) return 'text-amber-700 bg-amber-50 ring-amber-200'
  return 'text-rose-700 bg-rose-50 ring-rose-200'
}
