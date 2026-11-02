import { Link } from 'react-router-dom'
import { useApi } from '../../api'
import { useAuth } from '../../auth'
import { AuthShell } from '../../components/Layout'
import { Loading } from '../../components/ui'
import { IconTrophy } from '../../components/Icons'
import { sar } from '../../lib/util'
import type { PublicResults as Results, PublicWinner } from '../../../shared/types'

// Winners only; no scores of other units and no student names.
export function WinnersBoard() {
  const { data, loading } = useApi<Results>('/public/results')
  if (loading || !data) return <Loading />
  if (!data.published) return <div className="card p-10 text-center text-ink-3">لم تُعلن النتائج بعد</div>
  return (
    <div className="space-y-5">
      <Board title="أفضل الغرف" prize={data.roomPrizeAmount} rows={data.rooms} />
      <Board title="أفضل الأجنحة" prize={data.wingPrizeAmount} rows={data.wings} />
    </div>
  )
}

function Board({ title, prize, rows }: { title: string; prize: number; rows: PublicWinner[] }) {
  const winners = rows.filter((r) => !r.tied)
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <IconTrophy className="text-gold-500" /> {title}
        <span className="ms-auto text-sm font-medium text-ink-3">{sar(prize)} لكل فائز</span>
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {winners.map((r) => (
          <li key={r.name + r.location} className="flex items-center gap-3 rounded-xl bg-gold-400/15 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-400 font-bold">{r.rank}</span>
            <div>
              <div className="font-bold">{r.name}</div>
              <div className="text-xs text-ink-3">{r.location}</div>
            </div>
          </li>
        ))}
      </ol>
      {rows.some((r) => r.tied) && <p className="mt-3 text-sm text-ink-3">باقي المراكز قيد المراجعة من اللجنة.</p>}
      {rows.length === 0 && <p className="text-sm text-ink-3">لا توجد نتائج</p>}
    </section>
  )
}

export function PublicResults() {
  const { me } = useAuth()
  return (
    <AuthShell title="جائزة أفضل غرفة وأفضل جناح" sub="السكن الطلابي — عمادة شؤون الطلاب">
      <WinnersBoard />
      <div className="mt-8 text-center">
        <Link to={me ? '/' : '/login'} className="text-sm text-brand-700">{me ? 'العودة' : 'تسجيل الدخول'}</Link>
      </div>
    </AuthShell>
  )
}
