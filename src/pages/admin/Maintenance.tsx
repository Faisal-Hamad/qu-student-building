import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, useApi } from '../../api'
import { useAuth } from '../../auth'
import { Empty, ErrorText, Field, Loading, Modal, PageTitle, Pager, StatusChip, useAction } from '../../components/ui'
import { IconDownload } from '../../components/Icons'
import { exportExcel, formatDate, timeAgo } from '../../lib/util'
import { LOCATIONS, PROBLEM_TYPES, STATUSES, type Status } from '../../../shared/constants'
import type { Housing, MaintenanceEvent, MaintenanceRequest, StaffRow } from '../../../shared/types'

const PAGE = 30

export default function Maintenance() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const [f, setF] = useState({ status: 'open', type: '', buildingId: '', q: '', mine: false })
  const [page, setPage] = useState(1)
  const housing = useApi<Housing>('/housing')
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE), status: f.status, type: f.type, buildingId: f.buildingId, q: f.q, mine: f.mine ? '1' : '' })
  const list = useApi<{ rows: MaintenanceRequest[]; total: number }>(`/maintenance?${qs}`)
  const openId = Number(params.get('open')) || null
  const { busy, run } = useAction()

  const setFilter = (patch: Partial<typeof f>) => {
    setF({ ...f, ...patch })
    setPage(1)
  }

  const exportAll = () =>
    run(async () => {
      const all = await api<{ rows: MaintenanceRequest[] }>(`/maintenance?${new URLSearchParams({ ...Object.fromEntries(qs), export: '1', page: '1' })}`)
      await exportExcel(`بلاغات-الصيانة-${new Date().toISOString().slice(0, 10)}.xlsx`, all.rows, [
        { title: 'رقم البلاغ', value: (r) => r.sr, width: 12 },
        { title: 'اسم الطالب', value: (r) => r.studentName, width: 24 },
        { title: 'الرقم الجامعي', value: (r) => r.studentUniversityId, width: 14 },
        { title: 'الجوال', value: (r) => r.studentPhone, width: 14 },
        { title: 'الموقع', value: (r) => r.locationLabel, width: 30 },
        { title: 'نوع المشكلة', value: (r) => PROBLEM_TYPES[r.problemType], width: 12 },
        { title: 'الوصف', value: (r) => r.description, width: 40 },
        { title: 'الحالة', value: (r) => STATUSES[r.status], width: 12 },
        { title: 'الفني', value: (r) => r.assignedName, width: 20 },
        { title: 'تاريخ البلاغ', value: (r) => formatDate(r.createdAt), width: 22 },
        { title: 'تاريخ الإنجاز', value: (r) => formatDate(r.completedAt), width: 22 },
      ])
    })

  return (
    <>
      <PageTitle
        title="بلاغات الصيانة"
        sub={list.data ? `${list.data.total} بلاغ` : undefined}
        actions={can('maintenance.export') && <button className="btn-ghost" disabled={busy} onClick={exportAll}><IconDownload width={16} /> {busy ? 'جارِ التصدير…' : 'تصدير Excel'}</button>}
      />

      <div className="card mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input lg:col-span-2" placeholder="بحث برقم البلاغ أو اسم الطالب أو رقمه…" value={f.q} onChange={(e) => setFilter({ q: e.target.value })} />
        <select className="input" value={f.status} onChange={(e) => setFilter({ status: e.target.value })} aria-label="الحالة">
          <option value="open">المفتوحة (جديد + قيد التنفيذ)</option>
          <option value="">كل الحالات</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={f.type} onChange={(e) => setFilter({ type: e.target.value })} aria-label="النوع">
          <option value="">كل الأنواع</option>
          {Object.entries(PROBLEM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={f.buildingId} onChange={(e) => setFilter({ buildingId: e.target.value })} aria-label="المبنى">
          <option value="">كل المباني</option>
          {housing.data?.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-2 px-1 text-sm text-ink-2 lg:col-span-5">
          <input type="checkbox" className="size-4 accent-brand-700" checked={f.mine} onChange={(e) => setFilter({ mine: e.target.checked })} />
          المسندة لي فقط
        </label>
      </div>

      <div className="card overflow-hidden">
        {list.loading && !list.data ? (
          <Loading />
        ) : list.data?.rows.length === 0 ? (
          <Empty>لا توجد بلاغات</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-start">رقم البلاغ</th>
                  <th className="px-3 py-2 text-start">المشكلة والموقع</th>
                  <th className="px-3 py-2 text-start">الطالب</th>
                  <th className="px-3 py-2 text-start">الفني</th>
                  <th className="px-3 py-2 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.data?.rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-canvas/60" onClick={() => setParams({ open: String(r.id) })}>
                    <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">{r.sr}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{PROBLEM_TYPES[r.problemType]} · {LOCATIONS[r.location]}</div>
                      <div className="text-xs text-ink-3">{r.locationLabel} · {timeAgo(r.createdAt)}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{r.studentName}</div>
                      <div className="text-xs text-ink-3">{r.studentUniversityId}</div>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{r.assignedName ?? '—'}</td>
                    <td className="px-3 py-2.5"><StatusChip status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pager page={page} total={list.data.total} pageSize={PAGE} onPage={setPage} />}
      </div>

      {openId && (
        <RequestDetail
          id={openId}
          onClose={() => setParams({})}
          onChanged={list.reload}
        />
      )}
    </>
  )
}

function RequestDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth()
  const q = useApi<{ request: MaintenanceRequest; events: MaintenanceEvent[] }>(`/maintenance/${id}`)
  const staff = useApi<StaffRow[]>(can('maintenance.assign') ? '/staff' : null)
  const [note, setNote] = useState('')
  const { busy, error, run } = useAction()

  const patch = (body: Record<string, unknown>) =>
    run(async () => {
      await api(`/maintenance/${id}`, { method: 'PATCH', body })
      setNote('')
      q.reload()
      onChanged()
    })

  const r = q.data?.request
  return (
    <Modal title={r ? `البلاغ ${r.sr}` : 'البلاغ'} onClose={onClose} wide>
      {!r ? (
        q.error ? <ErrorText>{q.error}</ErrorText> : <Loading />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl bg-canvas p-4 text-sm sm:grid-cols-2">
            <Info label="نوع المشكلة" value={PROBLEM_TYPES[r.problemType]} />
            <Info label="المكان" value={`${r.locationLabel}`} />
            <Info label="الطالب" value={`${r.studentName} (${r.studentUniversityId ?? '—'})`} />
            <Info label="الجوال" value={r.studentPhone ? <a href={`tel:${r.studentPhone}`} className="text-brand-700" dir="ltr">{r.studentPhone}</a> : '—'} />
            <Info label="تاريخ البلاغ" value={formatDate(r.createdAt)} />
            <Info label="الحالة" value={<StatusChip status={r.status} />} />
            <div className="sm:col-span-2">
              <div className="text-xs text-ink-3">الوصف</div>
              <p className="mt-0.5 whitespace-pre-wrap">{r.description}</p>
            </div>
          </div>

          {can('maintenance.assign') && (
            <Field label="الفني المسؤول">
              <select className="input" value={r.assignedTo ?? ''} disabled={busy} onChange={(e) => patch({ assignedTo: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— غير مسند —</option>
                {staff.data?.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}

          {can('maintenance.update') && (
            <div className="space-y-2">
              <Field label="ملاحظة (تظهر للطالب مع تغيير الحالة)">
                <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: تم تغيير فلتر المكيف" />
              </Field>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUSES) as Status[]).filter((s) => s !== r.status).map((s) => (
                  <button key={s} className={s === 'done' ? 'btn-primary' : s === 'rejected' ? 'btn-danger' : 'btn-ghost'} disabled={busy} onClick={() => patch({ status: s, note: note || undefined })}>
                    تحويل إلى: {STATUSES[s]}
                  </button>
                ))}
                {note && <button className="btn-ghost" disabled={busy} onClick={() => patch({ note })}>إضافة ملاحظة فقط</button>}
              </div>
            </div>
          )}
          <ErrorText>{error}</ErrorText>

          <div>
            <h3 className="mb-2 font-bold">سجل البلاغ</h3>
            <ol className="space-y-2 border-s-2 border-line ps-4 text-sm">
              {q.data!.events.map((e) => (
                <li key={e.id}>
                  <div>
                    {e.action === 'created' && 'تم رفع البلاغ'}
                    {e.action === 'status' && <>تغيرت الحالة من {STATUSES[e.fromStatus!]} إلى <b>{STATUSES[e.toStatus!]}</b></>}
                    {e.action === 'assigned' && (e.note ? <>أُسند إلى <b>{e.note}</b></> : 'أُلغي الإسناد')}
                    {e.action === 'note' && 'ملاحظة'}
                    {e.note && e.action !== 'assigned' && <span className="block text-ink-2">«{e.note}»</span>}
                  </div>
                  <div className="text-xs text-ink-3">{e.actorName ?? '—'} · {formatDate(e.createdAt)}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  )
}
