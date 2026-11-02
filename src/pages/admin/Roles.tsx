import { useState } from 'react'
import { api, useApi } from '../../api'
import { useAuth } from '../../auth'
import { ConfirmButton, ErrorText, Field, Loading, PageTitle, useAction } from '../../components/ui'
import { IconCheck, IconChevron, IconPlus, IconX } from '../../components/Icons'
import { PERMISSION_GROUPS } from '../../../shared/permissions'
import type { Role, UserKind } from '../../../shared/types'

export default function Roles() {
  const { can } = useAuth()
  const list = useApi<Role[]>('/roles')
  const [editing, setEditing] = useState<Role | { kind: UserKind } | null>(null)

  if (editing) return <RoleEditor role={editing} onDone={() => (setEditing(null), list.reload())} />

  const section = (kind: UserKind, title: string, sub: string) => (
    <div className="card mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="text-xs text-ink-3">{sub}</p>
        </div>
        {can('roles.create') && <button className="btn-ghost" onClick={() => setEditing({ kind })}><IconPlus width={16} /> إضافة صلاحية</button>}
      </div>
      <ul className="divide-y divide-line">
        {list.data?.filter((r) => r.kind === kind).map((r) => (
          <li key={r.id}>
            <button disabled={!can('roles.edit')} onClick={() => setEditing(r)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-canvas/60 disabled:cursor-default">
              <div>
                <div className="font-semibold">{r.nameAr} {r.isDefault && <span className="chip ms-1 bg-brand-50 text-brand-700 ring-brand-200">الافتراضية</span>}</div>
                <div className="text-xs text-ink-3">{r.nameEn} · {r.permissions.length} صلاحية فرعية · {r.userCount} مستخدم</div>
              </div>
              {can('roles.edit') && <IconChevron className="ms-auto text-ink-3" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <>
      <PageTitle title="الصلاحيات" sub="مدير النظام (العميد) يملك كل الصلاحيات دائماً، ويوزعها على الموظفين والطلاب من هنا" />
      {!list.data ? <Loading /> : (
        <>
          {section('staff', 'صلاحيات الموظفين', 'تحدد ما يظهر للموظف في لوحة المشرفين وما يقدر يسويه')}
          {section('student', 'صلاحيات الطلاب', 'تحدد ما يقدر الطالب يسويه في بوابة الطالب')}
        </>
      )}
    </>
  )
}

function RoleEditor({ role, onDone }: { role: Role | { kind: UserKind }; onDone: () => void }) {
  const { can, me } = useAuth()
  const existing = 'id' in role ? role : null
  const [nameAr, setNameAr] = useState(existing?.nameAr ?? '')
  const [nameEn, setNameEn] = useState(existing?.nameEn ?? '')
  const [perms, setPerms] = useState<Set<string>>(new Set(existing?.permissions ?? []))
  const { busy, error, run } = useAction()
  const groups = PERMISSION_GROUPS.filter((g) => g.kind === role.kind)
  const allKeys = groups.flatMap((g) => g.items.map((i) => i.key))
  // Non-super users can only grant what they hold (the API enforces the same rule).
  const grantable = (k: string) => role.kind === 'student' || me!.isSuper || me!.permissions.includes(k)

  const set = (keys: string[], on: boolean) => {
    const next = new Set(perms)
    keys.filter(grantable).forEach((k) => (on ? next.add(k) : next.delete(k)))
    setPerms(next)
  }

  const save = () =>
    run(async () => {
      const body = { nameAr, nameEn, permissions: [...perms] }
      await api(existing ? `/roles/${existing.id}` : '/roles', { method: existing ? 'PATCH' : 'POST', body: existing ? body : { ...body, kind: role.kind } })
      onDone()
    })

  return (
    <>
      <PageTitle title={existing ? 'تعديل الصلاحية' : 'إضافة صلاحية'} sub={role.kind === 'staff' ? 'صلاحية موظفين' : 'صلاحية طلاب'} actions={<button className="btn-ghost" onClick={onDone}>رجوع</button>} />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <Field label="الاسم بالعربي *"><input className="input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: مشرف مبنى" /></Field>
        <Field label="الاسم بالإنجليزي"><input className="input" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Building supervisor" /></Field>
        <button className="btn-primary" onClick={() => set(allKeys, true)}><IconCheck width={16} /> تحديد الكل</button>
        <button className="btn bg-gold-400 text-ink hover:bg-gold-500" onClick={() => set(allKeys, false)}><IconX width={16} /> إزالة التحديد</button>
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const keys = g.items.map((i) => i.key)
          const all = keys.every((k) => perms.has(k))
          return (
            <section key={g.id} className="card p-4">
              <h2 className="font-bold">{g.title}</h2>
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-brand-700" checked={all} onChange={(e) => set(keys, e.target.checked)} />
                تحديد الكل
              </label>
              <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                {g.items.map((i) => (
                  <label key={i.key} className={`flex items-center gap-2 text-sm ${grantable(i.key) ? '' : 'opacity-40'}`}>
                    <input type="checkbox" className="size-4 accent-brand-700" disabled={!grantable(i.key)} checked={perms.has(i.key)} onChange={(e) => set([i.key], e.target.checked)} />
                    {i.label}
                  </label>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className="mt-4 space-y-3">
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary px-8" disabled={busy || !nameAr.trim()} onClick={save}>{busy ? 'جارِ الحفظ…' : 'حفظ'}</button>
          {existing?.kind === 'student' && !existing.isDefault && (
            <button className="btn-ghost" disabled={busy} onClick={() => run(async () => (await api(`/roles/${existing.id}`, { method: 'PATCH', body: { isDefault: true } }), onDone()))}>
              جعلها الافتراضية للطلاب الجدد
            </button>
          )}
          {existing && !existing.isDefault && can('roles.delete') && (
            <ConfirmButton onConfirm={() => run(async () => (await api(`/roles/${existing.id}`, { method: 'DELETE' }), onDone()))}>حذف الصلاحية</ConfirmButton>
          )}
        </div>
      </div>
    </>
  )
}
