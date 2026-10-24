import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { rankings } from '../lib/scoring'
import { formatDate, sar } from '../lib/util'
import { PageTitle, Progress, ScoreBadge, Stat } from '../components/ui'
import { IconAlert, IconChevron } from '../components/Icons'

export default function Home() {
  const { db, user } = useStore()
  const rooms = rankings(db, 'room')
  const wings = rankings(db, 'wing')
  const doneRooms = rooms.filter((r) => r.status !== 'pending').length
  const doneWings = wings.filter((r) => r.status !== 'pending').length
  const { roomPrizeCount, roomPrizeAmount, wingPrizeCount, wingPrizeAmount } = db.settings
  const totalPrizes = roomPrizeCount * roomPrizeAmount + wingPrizeCount * wingPrizeAmount
  const ties = [...rooms, ...wings].some((r) => r.tiedAtCutoff)

  const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? '—'
  const recent = [...db.inspections].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)
  const roomLabel = (id: string) => {
    const r = db.rooms.find((x) => x.id === id)
    return `غرفة ${r?.name ?? ''} · جناح ${db.wings.find((w) => w.id === r?.wingId)?.name ?? ''}`
  }
  const unitName = (type: string, id: string) =>
    type === 'room' ? roomLabel(id) : `جناح ${db.wings.find((w) => w.id === id)?.name ?? ''}`

  return (
    <>
      <PageTitle title={`أهلاً، ${user?.name}`} sub="ملخص تفتيش السكن وجائزة أفضل غرفة وأفضل جناح" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="الغرف المفتشة" value={`${doneRooms} / ${rooms.length}`} hint={<Progress value={(doneRooms / Math.max(1, rooms.length)) * 100} />} />
        <Stat label="الأجنحة المفتشة" value={`${doneWings} / ${wings.length}`} hint={<Progress value={(doneWings / Math.max(1, wings.length)) * 100} />} />
        <Stat label="جوائز الغرف" value={sar(roomPrizeCount * roomPrizeAmount)} hint={<span className="text-xs text-ink-3">{roomPrizeCount} غرف × {sar(roomPrizeAmount)}</span>} />
        <Stat label="جوائز الأجنحة" value={sar(wingPrizeCount * wingPrizeAmount)} hint={<span className="text-xs text-ink-3">{wingPrizeCount} أجنحة × {sar(wingPrizeAmount)} · الإجمالي {sar(totalPrizes)}</span>} />
      </div>

      {ties && (
        <Link to="/results" className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <IconAlert className="shrink-0" />
          يوجد تعادل عند آخر مركز فائز — يحتاج قرار من اللجنة
          <IconChevron className="ms-auto" />
        </Link>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Leaders title="أعلى الغرف حالياً" rows={rooms.filter((r) => r.status === 'ranked').slice(0, 5)} />
        <Leaders title="أعلى الأجنحة حالياً" rows={wings.filter((r) => r.status === 'ranked').slice(0, 5)} />
      </div>

      <div className="card mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">آخر عمليات التفتيش</h2>
          <Link to="/units" className="text-sm font-medium text-brand-700">ابدأ التفتيش</Link>
        </div>
        {recent.length === 0 && <p className="py-6 text-center text-sm text-ink-3">لا يوجد تفتيش بعد</p>}
        <ul className="divide-y divide-line">
          {recent.map((i) => (
            <li key={i.id}>
              <Link to={`/inspect/${i.targetType}/${i.targetId}`} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="font-medium">{unitName(i.targetType, i.targetId)}</span>
                <span className="text-xs text-ink-3">{memberName(i.inspectorId)} · {formatDate(i.updatedAt)}</span>
                {i.disqualified && <span className="chip ms-auto bg-rose-50 text-rose-700 ring-rose-200">مستبعد</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

function Leaders({ title, rows }: { title: string; rows: ReturnType<typeof rankings> }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{title}</h2>
        <Link to="/results" className="text-sm font-medium text-brand-700">كل النتائج</Link>
      </div>
      {rows.length === 0 && <p className="py-6 text-center text-sm text-ink-3">لا توجد نتائج بعد</p>}
      <ol className="space-y-2">
        {rows.map((r) => (
          <li key={r.targetId} className="flex items-center gap-3 text-sm">
            <span className="grid size-7 place-items-center rounded-full bg-canvas text-xs font-bold text-ink-2">{r.rank}</span>
            <div className="min-w-0">
              <div className="font-medium">{r.name}</div>
              <div className="truncate text-xs text-ink-3">{r.location}</div>
            </div>
            <ScoreBadge percent={r.score!.percent} className="ms-auto" />
          </li>
        ))}
      </ol>
    </div>
  )
}
