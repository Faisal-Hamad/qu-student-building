import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { latestInspection, round1, scoreInspection, scoreTone } from '../lib/scoring'
import type { TargetType } from '../lib/types'
import { PageTitle } from '../components/ui'

export default function Units() {
  const { db } = useStore()
  const [buildingId, setBuildingId] = useState(db.buildings[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)

  const status = (type: TargetType, id: string) => {
    const insp = latestInspection(db, type, id)
    if (!insp) return { label: 'لم يُفتش', cls: 'bg-white text-ink-3 ring-line', done: false }
    if (insp.disqualified) return { label: 'مستبعد', cls: 'bg-rose-50 text-rose-700 ring-rose-200', done: true }
    const p = scoreInspection(type === 'room' ? db.roomTemplate : db.wingTemplate, insp, db.settings.maxScore).percent
    return { label: `${round1(p)}٪`, cls: scoreTone(p), done: true }
  }

  const q = query.trim()
  const wings = db.wings
    .filter((w) => (q ? true : w.buildingId === buildingId))
    .map((w) => ({
      wing: w,
      rooms: db.rooms.filter((r) => r.wingId === w.id && (!q || w.name.includes(q) || r.students.some((s) => s.includes(q)))),
    }))
    .filter(({ wing, rooms }) => !q || rooms.length > 0 || wing.name.includes(q))
    .filter(({ wing, rooms }) => !pendingOnly || !status('wing', wing.id).done || rooms.some((r) => !status('room', r.id).done))

  if (db.buildings.length === 0) {
    return (
      <>
        <PageTitle title="التفتيش" />
        <div className="card p-8 text-center text-sm text-ink-3">لم تتم إضافة مبانٍ بعد. أضفها من صفحة الإدارة ← السكن.</div>
      </>
    )
  }

  return (
    <>
      <PageTitle title="التفتيش" sub="اختر الجناح أو الغرفة لبدء التقييم أو تعديله" />

      <div className="mb-4 space-y-3">
        <input className="input" placeholder="ابحث برقم الجناح أو اسم الطالب…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          {!q &&
            db.buildings.map((b) => (
              <button
                key={b.id}
                onClick={() => setBuildingId(b.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${b.id === buildingId ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink-2 ring-line'}`}
              >
                {b.name}
              </button>
            ))}
          <label className="ms-auto flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} className="size-4 accent-brand-700" />
            غير المفتش فقط
          </label>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {wings.map(({ wing, rooms }) => {
          const ws = status('wing', wing.id)
          return (
            <div key={wing.id} className="card p-4">
              <Link to={`/inspect/wing/${wing.id}`} className="flex items-center gap-3 rounded-xl bg-brand-50 p-3">
                <div>
                  <div className="font-bold text-brand-800">جناح {wing.name}</div>
                  <div className="text-xs text-ink-3">
                    {db.buildings.find((b) => b.id === wing.buildingId)?.name} · المطبخ، الصالة، دورة المياه، المراوش
                  </div>
                </div>
                <span className={`chip ms-auto ${ws.cls}`}>{ws.label}</span>
              </Link>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rooms
                  .filter((r) => !pendingOnly || !status('room', r.id).done)
                  .map((r) => {
                    const s = status('room', r.id)
                    return (
                      <Link key={r.id} to={`/inspect/room/${r.id}`} className="rounded-xl p-2.5 ring-1 ring-line transition hover:ring-brand-200">
                        <div className="text-sm font-semibold">غرفة {r.name}</div>
                        <span className={`chip mt-1 ${s.cls}`}>{s.label}</span>
                      </Link>
                    )
                  })}
              </div>
            </div>
          )
        })}
        {wings.length === 0 && <div className="card p-8 text-center text-sm text-ink-3 md:col-span-2">لا توجد نتائج</div>}
      </div>
    </>
  )
}
