import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../api'
import { useAuth } from '../../auth'
import { Empty, Loading, Modal, PageTitle, Pager, StatusChip } from '../../components/ui'
import { IconPlus } from '../../components/Icons'
import { PhotoGallery } from '../../components/Photos'
import { formatDate, timeAgo } from '../../lib/util'
import { LOCATIONS, PROBLEM_TYPES, STATUSES } from '../../../shared/constants'
import type { MaintenanceEvent, MaintenanceRequest } from '../../../shared/types'

const PAGE = 20

export default function MyRequests() {
  const { me, can } = useAuth()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const list = useApi<{ rows: MaintenanceRequest[]; total: number }>(can('portal.maintenance_view') ? `/maintenance?page=${page}&pageSize=${PAGE}` : null)
  const openId = Number(params.get('open')) || null

  return (
    <>
      <PageTitle
        title="بلاغاتي"
        actions={can('portal.maintenance_create') && me?.room && !me.requestsBlocked && <Link to="/student/new" className="btn-primary"><IconPlus width={16} /> بلاغ جديد</Link>}
      />
      {!can('portal.maintenance_view') ? (
        <div className="card p-8 text-center text-ink-3">ليس لديك صلاحية عرض البلاغات</div>
      ) : (
        <div className="card overflow-hidden">
          {!list.data ? <Loading /> : list.data.rows.length === 0 ? <Empty>لا توجد بلاغات</Empty> : (
            <ul className="divide-y divide-line">
              {list.data.rows.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setParams({ open: String(r.id) })} className="flex w-full items-center gap-3 px-4 py-3 text-start text-sm hover:bg-canvas/60">
                    <div className="min-w-0">
                      <div className="font-medium">{PROBLEM_TYPES[r.problemType]} · {LOCATIONS[r.location]}</div>
                      <div className="truncate text-xs text-ink-3"><span dir="ltr">{r.sr}</span> · {timeAgo(r.createdAt)}</div>
                    </div>
                    <span className="ms-auto"><StatusChip status={r.status} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.data && <Pager page={page} total={list.data.total} pageSize={PAGE} onPage={setPage} />}
        </div>
      )}
      {openId && <Detail id={openId} onClose={() => setParams({})} />}
    </>
  )
}

function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useApi<{ request: MaintenanceRequest; events: MaintenanceEvent[]; photos: { id: number }[] }>(`/maintenance/${id}`)
  const r = q.data?.request
  return (
    <Modal title={r ? `البلاغ ${r.sr}` : 'البلاغ'} onClose={onClose}>
      {!r ? <Loading /> : (
        <div className="space-y-4 text-sm">
          <div className="space-y-1 rounded-xl bg-canvas p-3">
            <div className="flex items-center justify-between"><b>{PROBLEM_TYPES[r.problemType]}</b><StatusChip status={r.status} /></div>
            <div className="text-ink-2">{r.locationLabel}</div>
            <p className="whitespace-pre-wrap pt-1">{r.description}</p>
          </div>
          <PhotoGallery ids={q.data!.photos} />
          <ol className="space-y-2 border-s-2 border-line ps-4">
            {q.data!.events.filter((e) => e.action !== 'assigned').map((e) => (
              <li key={e.id}>
                <div>
                  {e.action === 'created' && 'تم رفع البلاغ'}
                  {e.action === 'status' && <>الحالة: <b>{STATUSES[e.toStatus!]}</b></>}
                  {e.action === 'note' && 'ملاحظة من إدارة السكن'}
                </div>
                {e.note && <div className="text-ink-2">«{e.note}»</div>}
                <div className="text-xs text-ink-3">{formatDate(e.createdAt)}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  )
}
