import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { rankings, round1, type RankRow } from '../lib/scoring'
import { download, formatDate, sar, toCSV } from '../lib/util'
import type { TargetType } from '../lib/types'
import { PageTitle, ScoreBadge } from '../components/ui'
import { IconAlert, IconDownload, IconPrint, IconTrophy } from '../components/Icons'

export default function Results() {
  const { db } = useStore()
  const [tab, setTab] = useState<TargetType>('room')
  const rows = rankings(db, tab)
  const isRoom = tab === 'room'
  const prizeCount = isRoom ? db.settings.roomPrizeCount : db.settings.wingPrizeCount
  const prizeAmount = isRoom ? db.settings.roomPrizeAmount : db.settings.wingPrizeAmount
  const tpl = isRoom ? db.roomTemplate : db.wingTemplate

  const ranked = rows.filter((r) => r.status === 'ranked')
  const winners = ranked.filter((r) => r.winner)
  const tied = ranked.filter((r) => r.tiedAtCutoff)
  const disq = rows.filter((r) => r.status === 'disqualified')
  const pending = rows.filter((r) => r.status === 'pending')

  const memberName = (id?: string) => db.members.find((m) => m.id === id)?.name ?? ''
  const studentsOf = (id: string) => db.rooms.find((r) => r.id === id)?.students.join('، ') ?? ''

  const exportCSV = () => {
    const header = ['الترتيب', isRoom ? 'الغرفة' : 'الجناح', 'الموقع', ...(isRoom ? ['الطلاب'] : []), ...(isRoom ? [] : tpl.map((s) => s.label)), 'النتيجة ٪', 'الحالة', 'الجائزة', 'المفتش', 'تاريخ التفتيش', 'ملاحظات']
    const body = rows.map((r) => [
      r.rank ?? '',
      r.name,
      r.location,
      ...(isRoom ? [studentsOf(r.targetId)] : []),
      ...(isRoom ? [] : tpl.map((_, i) => (r.score?.sections[i].percent != null ? round1(r.score.sections[i].percent!) : ''))),
      r.score ? round1(r.score.percent) : '',
      r.status === 'pending' ? 'لم يُفتش' : r.status === 'disqualified' ? `مستبعد: ${r.inspection?.disqualifyReason}` : r.tiedAtCutoff ? 'تعادل — بانتظار قرار اللجنة' : r.winner ? 'فائز' : '',
      r.winner ? prizeAmount : '',
      memberName(r.inspection?.inspectorId),
      r.inspection ? formatDate(r.inspection.updatedAt) : '',
      r.inspection?.notes ?? '',
    ])
    download(`نتائج-${isRoom ? 'الغرف' : 'الأجنحة'}.csv`, toCSV([header, ...body]), 'text/csv;charset=utf-8')
  }

  return (
    <>
      <PageTitle
        title="النتائج والفائزون"
        sub={`آخر تحديث: ${formatDate(new Date().toISOString())}`}
        actions={
          <>
            <button onClick={exportCSV} className="btn-ghost"><IconDownload /> تصدير Excel</button>
            <button onClick={() => window.print()} className="btn-ghost"><IconPrint /> طباعة</button>
          </>
        }
      />

      <div className="no-print mb-4 inline-flex rounded-xl bg-white p-1 ring-1 ring-line">
        {(['room', 'wing'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-5 py-2 text-sm font-semibold ${tab === t ? 'bg-brand-700 text-white' : 'text-ink-2'}`}>
            {t === 'room' ? 'أفضل غرفة' : 'أفضل جناح'}
          </button>
        ))}
      </div>
      <h2 className="mb-3 hidden text-lg font-bold print:block">{isRoom ? 'جائزة أفضل غرفة' : 'جائزة أفضل جناح'}</h2>

      <div className="card mb-4 bg-gradient-to-l from-brand-700 to-brand-800 p-5 text-white ring-0">
        <div className="flex items-center gap-3">
          <IconTrophy className="text-gold-400" width={28} height={28} />
          <div>
            <div className="font-bold">{isRoom ? `أفضل ${prizeCount} غرف` : `أفضل ${prizeCount} أجنحة`} — {sar(prizeAmount)} لكل {isRoom ? 'غرفة' : 'جناح'}</div>
            <div className="text-sm text-white/70">إجمالي الجوائز: {sar(prizeCount * prizeAmount)} · تم تفتيش {rows.length - pending.length} من {rows.length}</div>
          </div>
        </div>
      </div>

      {tied.length > 0 && (
        <div className="mb-4 flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <IconAlert className="mt-0.5 shrink-0" />
          <div>
            <b>تعادل عند آخر مركز فائز:</b> يتبقى {prizeCount - winners.length} {prizeCount - winners.length === 1 ? 'مركز' : 'مراكز'} بين {tied.length} متعادلين بنسبة {round1(tied[0].score!.percent)}٪
            ({tied.map((t) => t.name).join('، ')}). القرار للجنة: إعادة تفتيش، أو تقاسم الجائزة، أو زيادة عدد الفائزين.
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <p className="mb-4 text-sm text-ink-3">تنبيه: النتائج غير نهائية — {pending.length} {isRoom ? 'غرفة' : 'جناح'} لم يُفتش بعد.</p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...winners, ...tied].map((r) => (
          <WinnerCard key={r.targetId} row={r} type={tab} prize={prizeAmount} students={isRoom ? studentsOf(r.targetId) : ''} />
        ))}
        {winners.length + tied.length === 0 && <div className="card p-6 text-center text-sm text-ink-3 sm:col-span-2 lg:col-span-3">لا توجد نتائج بعد</div>}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-bold">الترتيب الكامل</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-xs text-ink-3">
              <tr>
                <th className="px-3 py-2 text-start">#</th>
                <th className="px-3 py-2 text-start">{isRoom ? 'الغرفة' : 'الجناح'}</th>
                {!isRoom && tpl.map((s) => <th key={s.id} className="px-3 py-2 text-start">{s.label}</th>)}
                <th className="px-3 py-2 text-start">النتيجة</th>
                <th className="px-3 py-2 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.targetId} className={r.winner ? 'bg-brand-50/50' : ''}>
                  <td className="px-3 py-2.5 font-bold text-ink-2">{r.rank ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/inspect/${tab}/${r.targetId}`} className="font-medium hover:text-brand-700">{r.name}</Link>
                    <div className="text-xs text-ink-3">{r.location}</div>
                  </td>
                  {!isRoom && tpl.map((s, i) => (
                    <td key={s.id} className="px-3 py-2.5 text-ink-2">{r.score?.sections[i].percent != null ? `${round1(r.score.sections[i].percent!)}٪` : '—'}</td>
                  ))}
                  <td className="px-3 py-2.5">{r.score ? <ScoreBadge percent={r.score.percent} /> : <span className="text-ink-3">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <Status row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {disq.length > 0 && (
        <div className="card mt-4 p-4">
          <h3 className="mb-2 font-bold text-rose-700">المستبعدون من الجائزة</h3>
          <ul className="space-y-1 text-sm">
            {disq.map((r) => (
              <li key={r.targetId}><b>{r.name}</b> <span className="text-ink-3">— {r.inspection?.disqualifyReason}</span></li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function Status({ row }: { row: RankRow }) {
  if (row.status === 'pending') return <span className="text-ink-3">لم يُفتش</span>
  if (row.status === 'disqualified') return <span className="chip bg-rose-50 text-rose-700 ring-rose-200">مستبعد</span>
  if (row.tiedAtCutoff) return <span className="chip bg-amber-50 text-amber-800 ring-amber-200">تعادل</span>
  if (row.winner) return <span className="chip bg-gold-400/25 text-ink ring-gold-400/50">فائز</span>
  if (row.score && !row.score.complete) return <span className="text-ink-3">تقييم ناقص</span>
  return null
}

function WinnerCard({ row, type, prize, students }: { row: RankRow; type: TargetType; prize: number; students: string }) {
  return (
    <Link to={`/inspect/${type}/${row.targetId}`} className={`card block p-4 ${row.tiedAtCutoff ? 'ring-amber-300' : 'ring-gold-400/60'}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold ${row.tiedAtCutoff ? 'bg-amber-100 text-amber-800' : 'bg-gold-400 text-ink'}`}>{row.rank}</span>
        <div className="min-w-0">
          <div className="font-bold">{row.name}</div>
          <div className="text-xs text-ink-3">{row.location}</div>
        </div>
        <ScoreBadge percent={row.score!.percent} className="ms-auto" />
      </div>
      {students && <div className="mt-2 text-xs text-ink-2">{students}</div>}
      <div className="mt-3 text-sm font-semibold">
        {row.tiedAtCutoff ? <span className="text-amber-800">تعادل — بانتظار قرار اللجنة</span> : <span className="text-brand-700">الجائزة: {sar(prize)}</span>}
      </div>
    </Link>
  )
}
