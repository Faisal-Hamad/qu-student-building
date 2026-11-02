import { Link } from 'react-router-dom'
import { useApi } from '../../api'
import { useAuth } from '../../auth'
import { ScoreBadge, StatusChip } from '../../components/ui'
import { IconAlert, IconChevron, IconPlus } from '../../components/Icons'
import { timeAgo } from '../../lib/util'
import { scoreInspection } from '../../../shared/scoring'
import { PROBLEM_TYPES } from '../../../shared/constants'
import type { MaintenanceRequest, Section } from '../../../shared/types'

interface MyInspection {
  room: { scores: Record<string, number>; disqualified: boolean; disqualifyReason: string; notes: string } | null
  wing: { scores: Record<string, number>; disqualified: boolean; disqualifyReason: string; notes: string } | null
  settings: { maxScore: number; roomTemplate: Section[]; wingTemplate: Section[] } | null
}

export default function StudentHome() {
  const { me, can } = useAuth()
  const requests = useApi<{ rows: MaintenanceRequest[] }>(can('portal.maintenance_view') ? '/maintenance?pageSize=5' : null)
  const insp = useApi<MyInspection>(can('portal.inspection_view') ? '/me/inspection' : null)
  const r = me?.room

  return (
    <div className="space-y-4">
      <div className="card bg-gradient-to-l from-brand-700 to-brand-800 p-5 text-white ring-0">
        <div className="text-sm text-white/70">أهلاً</div>
        <div className="text-xl font-bold">{me?.name}</div>
        <div className="mt-3 text-sm">
          {r ? <>سكنك: <b>{r.buildingName} · جناح {r.wingNumber} · غرفة {r.roomNumber}</b></> : 'لا توجد غرفة مسجلة لحسابك — راجع إدارة السكن'}
        </div>
      </div>

      {me?.requestsBlocked && (
        <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <IconAlert className="shrink-0" /> تم إيقاف استقبال البلاغات من حسابك. راجع إدارة السكن.
        </div>
      )}

      {can('portal.maintenance_create') && r && !me?.requestsBlocked && (
        <Link to="/student/new" className="card flex items-center gap-3 p-4 ring-brand-200 transition hover:bg-brand-50">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-700 text-white"><IconPlus /></span>
          <div>
            <div className="font-bold">رفع بلاغ صيانة</div>
            <div className="text-xs text-ink-3">أثاث، تكييف، سباكة، كهرباء</div>
          </div>
          <IconChevron className="ms-auto text-ink-3" />
        </Link>
      )}

      {can('portal.maintenance_view') && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">آخر بلاغاتي</h2>
            <Link to="/student/requests" className="text-sm font-medium text-brand-700">الكل</Link>
          </div>
          {requests.data?.rows.length === 0 && <p className="py-4 text-center text-sm text-ink-3">لا توجد بلاغات</p>}
          <ul className="divide-y divide-line">
            {requests.data?.rows.map((x) => (
              <li key={x.id}>
                <Link to={`/student/requests?open=${x.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{PROBLEM_TYPES[x.problemType]} <span className="font-mono text-xs text-ink-3" dir="ltr">{x.sr}</span></div>
                    <div className="text-xs text-ink-3">{timeAgo(x.createdAt)}</div>
                  </div>
                  <span className="ms-auto"><StatusChip status={x.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insp.data?.settings && (insp.data.room || insp.data.wing) && (
        <div className="card p-4">
          <h2 className="mb-3 font-bold">نتيجة التفتيش</h2>
          <div className="space-y-3">
            {(['room', 'wing'] as const).map((t) => {
              const x = insp.data![t]
              const s = insp.data!.settings!
              if (!x) return null
              const res = scoreInspection(t === 'room' ? s.roomTemplate : s.wingTemplate, x.scores, s.maxScore)
              return (
                <div key={t} className="rounded-xl bg-canvas p-3">
                  <div className="flex items-center justify-between">
                    <b>{t === 'room' ? 'غرفتي' : 'جناحي'}</b>
                    {x.disqualified ? <span className="chip bg-rose-50 text-rose-700 ring-rose-200">مستبعد</span> : <ScoreBadge percent={res.percent} />}
                  </div>
                  {t === 'wing' && (
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-ink-2">
                      {res.sections.map((sec) => sec.percent != null && <span key={sec.id}>{sec.label}: {Math.round(sec.percent)}٪</span>)}
                    </div>
                  )}
                  {x.disqualified && <p className="mt-1 text-xs text-rose-700">{x.disqualifyReason}</p>}
                  {x.notes && <p className="mt-1 text-xs text-ink-3">ملاحظة المفتش: {x.notes}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
