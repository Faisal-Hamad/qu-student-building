import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../api'
import { useAuth } from '../../auth'
import { Loading, PageTitle, ScoreBadge } from '../../components/ui'
import { IconAlert, IconDownload, IconPrint, IconTrophy } from '../../components/Icons'
import { exportExcel, formatDate, sar } from '../../lib/util'
import { rankings, round1, type RankRow } from '../../../shared/scoring'
import type { Housing, Inspection, Settings, TargetType } from '../../../shared/types'

export default function Results() {
  const { can } = useAuth()
  const housing = useApi<Housing>('/housing')
  const insp = useApi<Inspection[]>('/inspections')
  const settings = useApi<Settings>('/settings')
  const [tab, setTab] = useState<TargetType>('room')
  if (!housing.data || !insp.data || !settings.data) return <Loading />

  const s = settings.data
  const rows = rankings(housing.data, insp.data, s, tab)
  const isRoom = tab === 'room'
  const prizeCount = isRoom ? s.roomPrizeCount : s.wingPrizeCount
  const prizeAmount = isRoom ? s.roomPrizeAmount : s.wingPrizeAmount
  const tpl = isRoom ? s.roomTemplate : s.wingTemplate
  const ranked = rows.filter((r) => r.status === 'ranked')
  const winners = ranked.filter((r) => r.winner)
  const tied = ranked.filter((r) => r.tiedAtCutoff)
  const disq = rows.filter((r) => r.status === 'disqualified')
  const pending = rows.filter((r) => r.status === 'pending')

  const statusText = (r: RankRow) =>
    r.status === 'pending' ? 'لم يُفتش' : r.status === 'disqualified' ? `مستبعد: ${r.inspection?.disqualifyReason}` : r.tiedAtCutoff ? 'تعادل — بانتظار قرار اللجنة' : r.winner ? 'فائز' : ''

  const exportXlsx = () =>
    exportExcel(`نتائج-${isRoom ? 'الغرف' : 'الأجنحة'}-الجولة-${s.currentRound}.xlsx`, rows, [
      { title: 'الترتيب', value: (r) => r.rank ?? '', width: 8 },
      { title: isRoom ? 'الغرفة' : 'الجناح', value: (r) => r.name, width: 22 },
      { title: 'المبنى', value: (r) => r.location, width: 14 },
      ...(isRoom ? [] : tpl.map((sec, i) => ({ title: sec.label, value: (r: RankRow) => (r.score?.sections[i].percent != null ? round1(r.score.sections[i].percent!) : ''), width: 12 }))),
      { title: 'النتيجة ٪', value: (r) => (r.score ? round1(r.score.percent) : ''), width: 10 },
      { title: 'الحالة', value: statusText, width: 26 },
      { title: 'الجائزة', value: (r) => (r.winner ? prizeAmount : ''), width: 10 },
      { title: 'المفتش', value: (r) => r.inspection?.inspectorName, width: 20 },
      { title: 'تاريخ التفتيش', value: (r) => (r.inspection ? formatDate(r.inspection.updatedAt) : ''), width: 22 },
      { title: 'ملاحظات', value: (r) => r.inspection?.notes, width: 40 },
    ])

  return (
    <>
      <PageTitle
        title="النتائج والفائزون"
        sub={`الجولة ${s.currentRound} · ${s.publicResults ? 'معلنة للطلاب' : 'غير معلنة للطلاب'}`}
        actions={
          can('results.export') && (
            <>
              <button onClick={exportXlsx} className="btn-ghost"><IconDownload width={16} /> تصدير Excel</button>
              <button onClick={() => window.print()} className="btn-ghost"><IconPrint width={16} /> طباعة</button>
            </>
          )
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
            ({tied.map((t) => `${t.name} — ${t.location}`).join('، ')}). القرار للجنة: إعادة تفتيش، أو تقاسم الجائزة، أو زيادة عدد الفائزين.
          </div>
        </div>
      )}
      {pending.length > 0 && <p className="mb-4 text-sm text-ink-3">النتائج غير نهائية — {pending.length} {isRoom ? 'غرفة' : 'جناح'} لم يُفتش بعد.</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...winners, ...tied].map((r) => (
          <Link key={r.targetId} to={`/admin/inspect/${tab}/${r.targetId}`} className={`card block p-4 ${r.tiedAtCutoff ? 'ring-amber-300' : 'ring-gold-400/60'}`}>
            <div className="flex items-start gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold ${r.tiedAtCutoff ? 'bg-amber-100 text-amber-800' : 'bg-gold-400 text-ink'}`}>{r.rank}</span>
              <div className="min-w-0">
                <div className="font-bold">{r.name}</div>
                <div className="text-xs text-ink-3">{r.location}</div>
              </div>
              <ScoreBadge percent={r.score!.percent} className="ms-auto" />
            </div>
            <div className="mt-3 text-sm font-semibold">
              {r.tiedAtCutoff ? <span className="text-amber-800">تعادل — بانتظار قرار اللجنة</span> : <span className="text-brand-700">الجائزة: {sar(prizeAmount)}</span>}
            </div>
          </Link>
        ))}
        {winners.length + tied.length === 0 && <div className="card p-6 text-center text-sm text-ink-3 sm:col-span-2 lg:col-span-3">لا توجد نتائج بعد</div>}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-bold">الترتيب (المفتش فقط)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-xs text-ink-3">
              <tr>
                <th className="px-3 py-2 text-start">#</th>
                <th className="px-3 py-2 text-start">{isRoom ? 'الغرفة' : 'الجناح'}</th>
                {!isRoom && tpl.map((sec) => <th key={sec.id} className="px-3 py-2 text-start">{sec.label}</th>)}
                <th className="px-3 py-2 text-start">النتيجة</th>
                <th className="px-3 py-2 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...ranked, ...disq].map((r) => (
                <tr key={r.targetId} className={r.winner ? 'bg-brand-50/50' : ''}>
                  <td className="px-3 py-2.5 font-bold text-ink-2">{r.rank ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/admin/inspect/${tab}/${r.targetId}`} className="font-medium hover:text-brand-700">{r.name}</Link>
                    <div className="text-xs text-ink-3">{r.location}</div>
                  </td>
                  {!isRoom && tpl.map((sec, i) => <td key={sec.id} className="px-3 py-2.5 text-ink-2">{r.score?.sections[i].percent != null ? `${round1(r.score.sections[i].percent!)}٪` : '—'}</td>)}
                  <td className="px-3 py-2.5">{r.score ? <ScoreBadge percent={r.score.percent} /> : '—'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.status === 'disqualified' ? <span className="chip bg-rose-50 text-rose-700 ring-rose-200">مستبعد</span>
                      : r.tiedAtCutoff ? <span className="chip bg-amber-50 text-amber-800 ring-amber-200">تعادل</span>
                      : r.winner ? <span className="chip bg-gold-400/25 text-ink ring-gold-400/50">فائز</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ranked.length + disq.length === 0 && <p className="p-6 text-center text-sm text-ink-3">لا توجد تقييمات بعد</p>}
        </div>
      </div>
    </>
  )
}
