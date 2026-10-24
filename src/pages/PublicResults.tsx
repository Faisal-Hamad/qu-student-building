import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { rankings, type RankRow } from '../lib/scoring'
import { sar } from '../lib/util'
import { Logo } from '../components/Layout'
import { IconTrophy } from '../components/Icons'

// What students see: winners only, no scores of other rooms and no student names.
export default function PublicResults() {
  const { db, user } = useStore()
  const { publicResults, roomPrizeAmount, wingPrizeAmount } = db.settings

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-canvas px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <Logo className="mx-auto size-14" />
          <h1 className="mt-4 text-2xl font-bold">جائزة أفضل غرفة وأفضل جناح</h1>
          <p className="mt-1 text-sm text-ink-3">السكن الطلابي — عمادة شؤون الطلاب</p>
        </div>

        {!publicResults ? (
          <div className="card p-10 text-center text-ink-3">لم تُعلن النتائج بعد</div>
        ) : (
          <div className="space-y-6">
            <Board title="أفضل الغرف" prize={roomPrizeAmount} rows={rankings(db, 'room')} />
            <Board title="أفضل الأجنحة" prize={wingPrizeAmount} rows={rankings(db, 'wing')} />
          </div>
        )}

        <div className="mt-8 text-center">
          <Link to={user ? '/' : '/login'} className="text-sm text-brand-700">{user ? 'العودة للوحة التحكم' : 'دخول اللجنة'}</Link>
        </div>
      </div>
    </div>
  )
}

function Board({ title, prize, rows }: { title: string; prize: number; rows: RankRow[] }) {
  const winners = rows.filter((r) => r.winner)
  const tied = rows.filter((r) => r.tiedAtCutoff)
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <IconTrophy className="text-gold-500" /> {title}
        <span className="ms-auto text-sm font-medium text-ink-3">{sar(prize)} لكل فائز</span>
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {winners.map((r) => (
          <li key={r.targetId} className="flex items-center gap-3 rounded-xl bg-gold-400/15 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-gold-400 font-bold">{r.rank}</span>
            <div>
              <div className="font-bold">{r.name}</div>
              <div className="text-xs text-ink-3">{r.location}</div>
            </div>
          </li>
        ))}
      </ol>
      {tied.length > 0 && <p className="mt-3 text-sm text-ink-3">باقي المراكز قيد المراجعة من اللجنة.</p>}
      {winners.length === 0 && tied.length === 0 && <p className="text-sm text-ink-3">لا توجد نتائج بعد</p>}
    </section>
  )
}
