import { Link } from 'react-router-dom'
import { useApi } from '../../api'
import { useAuth } from '../../auth'
import { PageTitle, Progress, Stat, StatusChip } from '../../components/ui'
import { IconChevron } from '../../components/Icons'
import { timeAgo } from '../../lib/util'
import { PROBLEM_TYPES, type ProblemType, type Status } from '../../../shared/constants'
import type { Housing, Inspection, MaintenanceRequest } from '../../../shared/types'

export default function Dashboard() {
  const { me, can } = useAuth()
  const canMaint = can('maintenance.list')
  const canInsp = can('inspections.list')
  const stats = useApi<{ status: Status; type: ProblemType; n: number }[]>(canMaint ? '/maintenance/stats' : null)
  const recent = useApi<{ rows: MaintenanceRequest[] }>(canMaint ? '/maintenance?status=open&pageSize=6' : null)
  const housing = useApi<Housing>(canInsp ? '/housing' : null)
  const insp = useApi<Inspection[]>(canInsp ? '/inspections' : null)

  const sum = (f: (r: { status: Status; type: ProblemType }) => boolean) => (stats.data ?? []).filter(f).reduce((a, r) => a + r.n, 0)
  const openByType = Object.keys(PROBLEM_TYPES).map((t) => ({ t: t as ProblemType, n: sum((r) => r.type === t && (r.status === 'new' || r.status === 'in_progress')) }))
  const rooms = housing.data?.rooms.length ?? 0
  const wings = housing.data?.wings.length ?? 0
  const doneRooms = insp.data?.filter((i) => i.targetType === 'room').length ?? 0
  const doneWings = insp.data?.filter((i) => i.targetType === 'wing').length ?? 0

  return (
    <>
      <PageTitle title={`أهلاً، ${me?.name}`} sub={me?.roleName ?? undefined} />

      {canMaint && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="بلاغات جديدة" value={sum((r) => r.status === 'new')} />
            <Stat label="قيد التنفيذ" value={sum((r) => r.status === 'in_progress')} />
            <Stat label="منجزة" value={sum((r) => r.status === 'done')} />
            <Stat label="إجمالي البلاغات" value={sum(() => true)} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
            <div className="card p-4">
              <h2 className="mb-3 font-bold">البلاغات المفتوحة حسب النوع</h2>
              <ul className="space-y-2.5">
                {openByType.map(({ t, n }) => {
                  const max = Math.max(1, ...openByType.map((x) => x.n))
                  return (
                    <li key={t} className="text-sm">
                      <div className="mb-1 flex justify-between"><span>{PROBLEM_TYPES[t]}</span><b>{n}</b></div>
                      <Progress value={(n / max) * 100} />
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">أحدث البلاغات المفتوحة</h2>
                <Link to="/admin/maintenance" className="text-sm font-medium text-brand-700">كل البلاغات</Link>
              </div>
              {recent.data?.rows.length === 0 && <p className="py-6 text-center text-sm text-ink-3">لا توجد بلاغات مفتوحة</p>}
              <ul className="divide-y divide-line">
                {recent.data?.rows.map((r) => (
                  <li key={r.id}>
                    <Link to={`/admin/maintenance?open=${r.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="font-mono text-xs text-ink-3" dir="ltr">{r.sr}</span>
                      <div className="min-w-0">
                        <div className="font-medium">{PROBLEM_TYPES[r.problemType]} — {r.locationLabel}</div>
                        <div className="truncate text-xs text-ink-3">{r.studentName} · {timeAgo(r.createdAt)}</div>
                      </div>
                      <span className="ms-auto"><StatusChip status={r.status} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {canInsp && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="الغرف المفتشة" value={`${doneRooms} / ${rooms}`} hint={<Progress value={(doneRooms / Math.max(1, rooms)) * 100} />} />
          <Stat label="الأجنحة المفتشة" value={`${doneWings} / ${wings}`} hint={<Progress value={(doneWings / Math.max(1, wings)) * 100} />} />
          <Link to="/admin/inspections" className="card col-span-2 flex items-center justify-between p-4 font-semibold text-brand-700 md:col-span-1">
            ابدأ التفتيش <IconChevron />
          </Link>
        </div>
      )}

      {!canMaint && !canInsp && <div className="card p-8 text-center text-sm text-ink-3">استخدم القائمة للوصول إلى الأقسام المتاحة لك.</div>}
    </>
  )
}
