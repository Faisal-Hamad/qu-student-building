import { useState } from 'react'
import { api, useApi } from '../../api'
import { useAuth } from '../../auth'
import { ConfirmButton, Empty, ErrorText, Field, Loading, Modal, PageTitle, useAction } from '../../components/ui'
import { IconMail, IconPlus } from '../../components/Icons'
import { formatDate } from '../../lib/util'
import type { Housing, Role, StaffRow } from '../../../shared/types'

export default function Staff() {
  const { can, me } = useAuth()
  const list = useApi<StaffRow[]>('/staff')
  const roles = useApi<Role[]>('/roles')
  const housing = useApi<Housing>('/housing')
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { error, run } = useAction()
  const roleName = (id: number | null) => roles.data?.find((r) => r.id === id)?.nameAr ?? 'بدون صلاحية'
  const bName = (id: number) => housing.data?.buildings.find((b) => b.id === id)?.name ?? `#${id}`

  const sendLink = (s: StaffRow) =>
    run(async () => {
      const r = await api<{ sent: boolean; link?: string }>(`/staff/${s.id}/send-link`, { body: {} })
      setNotice(r.sent ? `تم إرسال الرابط إلى ${s.email}` : `خدمة البريد غير مفعلة. انسخ هذا الرابط وأرسله للموظف (صالح 60 دقيقة):\n${r.link}`)
    })

  return (
    <>
      <PageTitle
        title="الموظفين"
        sub="المشرفون والفنيون ولجنة التفتيش"
        actions={can('staff.create') && <button className="btn-primary" onClick={() => setEditing('new')}><IconPlus width={16} /> إضافة موظف</button>}
      />
      {notice && (
        <div className="mb-4 flex items-start gap-3 whitespace-pre-wrap break-all rounded-xl bg-brand-50 p-3 text-sm text-brand-800 ring-1 ring-brand-200">
          <span className="flex-1">{notice}</span>
          <button className="text-xs" onClick={() => setNotice(null)}>إخفاء</button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>

      <div className="card mt-2 overflow-hidden">
        {!list.data ? <Loading /> : list.data.length === 0 ? <Empty>لا يوجد موظفون</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-start">الموظف</th>
                  <th className="px-3 py-2 text-start">الصلاحية</th>
                  <th className="px-3 py-2 text-start">المباني</th>
                  <th className="px-3 py-2 text-start">الحساب</th>
                  <th className="px-3 py-2 text-start"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.data.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-ink-3" dir="ltr">{s.email}</div>
                    </td>
                    <td className="px-3 py-2.5">{s.isSuper ? <span className="chip bg-gold-400/25 text-ink ring-gold-400/50">مدير النظام</span> : roleName(s.roleId)}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-2">{s.isSuper || !s.scopeBuildingIds ? 'كل المباني' : s.scopeBuildingIds.map(bName).join('، ')}</td>
                    <td className="px-3 py-2.5">
                      {s.status === 'suspended' ? <span className="chip bg-rose-50 text-rose-700 ring-rose-200">موقوف</span>
                        : s.activated ? <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">مفعّل</span>
                        : <span className="chip bg-white text-ink-3 ring-line">غير مفعّل</span>}
                      {s.lastLoginAt && <div className="mt-1 text-[11px] text-ink-3">آخر دخول {formatDate(s.lastLoginAt)}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {can('staff.edit') && (!s.isSuper || me?.isSuper) && <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setEditing(s)}>تعديل</button>}
                        {can('staff.create', 'staff.edit') && !s.isSuper && s.status === 'active' && (
                          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => sendLink(s)}><IconMail width={14} /> {s.activated ? 'رابط كلمة مرور' : 'رابط التفعيل'}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && roles.data && housing.data && (
        <StaffForm
          staff={editing === 'new' ? null : editing}
          roles={roles.data.filter((r) => r.kind === 'staff')}
          housing={housing.data}
          onClose={() => setEditing(null)}
          onSaved={() => (setEditing(null), list.reload())}
        />
      )}
    </>
  )
}

function StaffForm({ staff, roles, housing, onClose, onSaved }: { staff: StaffRow | null; roles: Role[]; housing: Housing; onClose: () => void; onSaved: () => void }) {
  const { can, me } = useAuth()
  const self = staff?.id === me?.id
  const [form, setForm] = useState({
    name: staff?.name ?? '', email: staff?.email ?? '', phone: staff?.phone ?? '',
    roleId: (staff ? staff.roleId : roles[0]?.id ?? null) as number | null,
    scopeBuildingIds: (staff?.scopeBuildingIds ?? null) as number[] | null,
    status: staff?.status ?? 'active',
  })
  const { busy, error, run } = useAction()

  const save = () =>
    run(async () => {
      const body: Record<string, unknown> = { name: form.name, email: form.email, phone: form.phone }
      if (!staff?.isSuper && !self) Object.assign(body, { roleId: form.roleId, scopeBuildingIds: form.scopeBuildingIds, ...(staff ? { status: form.status } : {}) })
      await api(staff ? `/staff/${staff.id}` : '/staff', { method: staff ? 'PATCH' : 'POST', body })
      onSaved()
    })

  const toggleBuilding = (id: number) => {
    const cur = form.scopeBuildingIds ?? []
    setForm({ ...form, scopeBuildingIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }

  return (
    <Modal title={staff ? 'تعديل موظف' : 'إضافة موظف'} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="الجوال"><input className="input" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Field label="البريد الإلكتروني" hint="يصله رابط التفعيل عليه"><input className="input" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>

        {!staff?.isSuper && !self && (
          <>
            <Field label="الصلاحية">
              <select className="input" value={form.roleId ?? ''} onChange={(e) => setForm({ ...form, roleId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">بدون صلاحية</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
              </select>
            </Field>
            <div>
              <div className="mb-1 text-sm font-medium text-ink-2">نطاق المباني</div>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-brand-700" checked={form.scopeBuildingIds === null} onChange={(e) => setForm({ ...form, scopeBuildingIds: e.target.checked ? null : [] })} />
                كل المباني
              </label>
              {form.scopeBuildingIds !== null && (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {housing.buildings.map((b) => (
                    <label key={b.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ring-1 ring-line">
                      <input type="checkbox" className="size-4 accent-brand-700" checked={form.scopeBuildingIds!.includes(b.id)} onChange={() => toggleBuilding(b.id)} />
                      {b.name}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-ink-3">الموظف يشوف البلاغات والطلاب والتفتيش للمباني المحددة فقط، ويوصله إشعار ببلاغاتها.</p>
            </div>
            {staff && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-rose-600" checked={form.status === 'suspended'} onChange={(e) => setForm({ ...form, status: e.target.checked ? 'suspended' : 'active' })} />
                إيقاف الحساب
              </label>
            )}
          </>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2 pt-1">
          <button className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? 'جارِ الحفظ…' : 'حفظ'}</button>
          {staff && !staff.isSuper && !self && can('staff.delete') && (
            <ConfirmButton onConfirm={() => run(async () => (await api(`/staff/${staff.id}`, { method: 'DELETE' }), onSaved()))}>حذف</ConfirmButton>
          )}
        </div>
      </div>
    </Modal>
  )
}
