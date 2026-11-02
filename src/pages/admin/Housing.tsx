import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, useApi } from '../../api'
import { useAuth } from '../../auth'
import { ConfirmButton, ErrorText, Loading, PageTitle, useAction } from '../../components/ui'
import { IconPlus, IconQr, IconTrash } from '../../components/Icons'
import { STANDARD_LAYOUT } from '../../../shared/constants'
import type { Housing as H } from '../../../shared/types'

export default function Housing() {
  const { can } = useAuth()
  const q = useApi<H>('/housing')
  const [open, setOpen] = useState<number | null>(null)
  const [count, setCount] = useState(15)
  const { busy, error, run } = useAction()
  const manage = can('housing.manage')
  const call = (path: string, method: string, body?: unknown) => run(async () => (await api(path, { method, body }), q.reload()))

  if (!q.data) return <Loading />
  const h = q.data
  const { floors, wingsPerFloor, firstWingRooms, otherWingRooms } = STANDARD_LAYOUT

  return (
    <>
      <PageTitle title="المباني والغرف" sub={`${h.buildings.length} مبنى · ${h.wings.length} جناح · ${h.rooms.length} غرفة · الطاقة ${h.rooms.reduce((a, r) => a + r.capacity, 0)} طالب`} />
      <ErrorText>{error}</ErrorText>

      {manage && (
        <div className="card my-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-60 flex-1">
            <div className="font-bold">إضافة مبانٍ بالهيكل القياسي</div>
            <p className="text-xs text-ink-3">
              كل مبنى: {floors} أدوار × {wingsPerFloor} أجنحة = {floors * wingsPerFloor} جناح · الجناح 1 فيه {firstWingRooms} غرف والباقي {otherWingRooms} غرف ={' '}
              {firstWingRooms + (floors * wingsPerFloor - 1) * otherWingRooms} غرفة
            </p>
          </div>
          <input type="number" min={1} max={50} className="input w-24" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="عدد المباني" />
          <button className="btn-primary" disabled={busy} onClick={() => call('/housing/standard', 'POST', { count })}>{busy ? 'جارِ الإنشاء…' : `إنشاء ${count} مبنى`}</button>
        </div>
      )}

      <div className="space-y-3">
        {h.buildings.map((b) => {
          const wings = h.wings.filter((w) => w.buildingId === b.id)
          const roomCount = h.rooms.filter((r) => wings.some((w) => w.id === r.wingId)).length
          return (
            <section key={b.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 p-3">
                {manage ? (
                  <input className="input max-w-48 font-bold" defaultValue={b.name} onBlur={(e) => e.target.value !== b.name && call(`/housing/buildings/${b.id}`, 'PATCH', { name: e.target.value })} aria-label="اسم المبنى" />
                ) : (
                  <b className="px-1">{b.name}</b>
                )}
                <span className="text-sm text-ink-3">{wings.length} جناح · {roomCount} غرفة</span>
                <button className="btn-ghost ms-auto px-3 py-1.5" onClick={() => setOpen(open === b.id ? null : b.id)}>{open === b.id ? 'إخفاء' : 'الأجنحة'}</button>
                {manage && <ConfirmButton className="btn-danger px-3 py-1.5" onConfirm={() => call(`/housing/buildings/${b.id}`, 'DELETE')}><IconTrash width={16} /></ConfirmButton>}
              </div>

              {open === b.id && (
                <div className="space-y-2 border-t border-line bg-canvas/50 p-3">
                  {wings.map((w) => {
                    const rooms = h.rooms.filter((r) => r.wingId === w.id)
                    return (
                      <div key={w.id} className="rounded-xl bg-white p-3 ring-1 ring-line">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">جناح {w.number}</span>
                          <span className="text-xs text-ink-3">الدور {w.floor} · {rooms.length} غرف</span>
                          <div className="ms-auto flex gap-1.5">
                            {can('housing.qr') && <Link to={`/admin/housing/qr/${w.id}`} className="btn-ghost px-2.5 py-1 text-xs"><IconQr width={14} /> الباركود</Link>}
                            {manage && (
                              <>
                                <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => call('/housing/rooms', 'POST', { wingId: w.id, number: Math.max(0, ...rooms.map((r) => r.number)) + 1 })}>
                                  <IconPlus width={14} /> غرفة
                                </button>
                                <ConfirmButton className="btn-danger px-2.5 py-1 text-xs" onConfirm={() => call(`/housing/wings/${w.id}`, 'DELETE')}>حذف الجناح</ConfirmButton>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {rooms.map((r) => (
                            <span key={r.id} className="inline-flex items-center gap-1 rounded-lg bg-canvas px-2 py-1 text-xs">
                              غرفة {r.number}
                              {manage && (
                                <button className="text-rose-600" aria-label={`حذف غرفة ${r.number}`} onClick={() => call(`/housing/rooms/${r.id}`, 'DELETE')}>
                                  <IconTrash width={12} height={12} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {manage && (
                    <button
                      className="btn-ghost w-full"
                      onClick={() => {
                        const n = Math.max(0, ...wings.map((w) => w.number)) + 1
                        call('/housing/wings', 'POST', { buildingId: b.id, number: n, floor: Math.ceil(n / wingsPerFloor), rooms: otherWingRooms })
                      }}
                    >
                      <IconPlus width={16} /> إضافة جناح
                    </button>
                  )}
                </div>
              )}
            </section>
          )
        })}
        {h.buildings.length === 0 && <div className="card p-8 text-center text-sm text-ink-3">لا توجد مبانٍ بعد</div>}
      </div>
    </>
  )
}
