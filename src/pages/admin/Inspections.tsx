import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../api'
import { Loading, PageTitle, scoreTone } from '../../components/ui'
import { round1, scoreInspection } from '../../../shared/scoring'
import type { Housing, Inspection, Settings, TargetType } from '../../../shared/types'

export default function Inspections() {
  const housing = useApi<Housing>('/housing')
  const insp = useApi<Inspection[]>('/inspections')
  const settings = useApi<Settings>('/settings')
  const [buildingId, setBuildingId] = useState<number | null>(null)
  const [floor, setFloor] = useState<number | null>(null)
  const [pendingOnly, setPendingOnly] = useState(false)

  useEffect(() => {
    if (!buildingId && housing.data?.buildings[0]) setBuildingId(housing.data.buildings[0].id)
  }, [housing.data, buildingId])

  const byKey = useMemo(() => new Map((insp.data ?? []).map((i) => [`${i.targetType}:${i.targetId}`, i])), [insp.data])

  if (!housing.data || !insp.data || !settings.data) return <Loading />
  if (housing.data.buildings.length === 0)
    return (
      <>
        <PageTitle title="التفتيش" />
        <div className="card p-8 text-center text-sm text-ink-3">لم تتم إضافة مبانٍ بعد. أضفها من «المباني والغرف».</div>
      </>
    )

  const s = settings.data
  const status = (type: TargetType, id: number) => {
    const i = byKey.get(`${type}:${id}`)
    if (!i) return { label: 'لم يُفتش', cls: 'bg-white text-ink-3 ring-line', done: false }
    if (i.disqualified) return { label: 'مستبعد', cls: 'bg-rose-50 text-rose-700 ring-rose-200', done: true }
    const p = scoreInspection(type === 'room' ? s.roomTemplate : s.wingTemplate, i.scores, s.maxScore).percent
    return { label: `${round1(p)}٪`, cls: scoreTone(p), done: true }
  }

  const wings = housing.data.wings.filter((w) => w.buildingId === buildingId && (floor == null || w.floor === floor))
  const floors = [...new Set(housing.data.wings.filter((w) => w.buildingId === buildingId).map((w) => w.floor))].sort()

  return (
    <>
      <PageTitle title="التفتيش" sub={`الجولة ${s.currentRound} · اختر الجناح أو الغرفة للتقييم`} />

      <div className="mb-3 flex flex-wrap gap-2">
        {housing.data.buildings.map((b) => (
          <button
            key={b.id}
            onClick={() => (setBuildingId(b.id), setFloor(null))}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${b.id === buildingId ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink-2 ring-line'}`}
          >
            {b.name}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setFloor(null)} className={`rounded-lg px-3 py-1 text-sm ring-1 ${floor == null ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-ink-2 ring-line'}`}>كل الأدوار</button>
        {floors.map((fl) => (
          <button key={fl} onClick={() => setFloor(fl)} className={`rounded-lg px-3 py-1 text-sm ring-1 ${floor === fl ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-white text-ink-2 ring-line'}`}>
            الدور {fl}
          </button>
        ))}
        <label className="ms-auto flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} className="size-4 accent-brand-700" />
          غير المفتش فقط
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {wings.map((wing) => {
          const ws = status('wing', wing.id)
          const rooms = housing.data!.rooms.filter((r) => r.wingId === wing.id && (!pendingOnly || !status('room', r.id).done))
          if (pendingOnly && ws.done && rooms.length === 0) return null
          return (
            <div key={wing.id} className="card p-4">
              <Link to={`/admin/inspect/wing/${wing.id}`} className="flex items-center gap-3 rounded-xl bg-brand-50 p-3">
                <div>
                  <div className="font-bold text-brand-800">جناح {wing.number}</div>
                  <div className="text-xs text-ink-3">الدور {wing.floor} · المطبخ، الصالة، دورة المياه، المراوش</div>
                </div>
                <span className={`chip ms-auto ${ws.cls}`}>{ws.label}</span>
              </Link>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {rooms.map((r) => {
                  const st = status('room', r.id)
                  return (
                    <Link key={r.id} to={`/admin/inspect/room/${r.id}`} className="rounded-xl p-2 ring-1 ring-line transition hover:ring-brand-200">
                      <div className="text-sm font-semibold">غرفة {r.number}</div>
                      <span className={`chip mt-1 ${st.cls}`}>{st.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
