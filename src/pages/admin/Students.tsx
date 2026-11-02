import { useState } from 'react'
import readXlsxFile from 'read-excel-file'
import { api, useApi } from '../../api'
import { useAuth } from '../../auth'
import { ConfirmButton, Empty, ErrorText, Field, Loading, Modal, PageTitle, Pager, useAction } from '../../components/ui'
import { RoomPicker } from '../../components/RoomPicker'
import { IconDownload, IconMail, IconPlus, IconUpload } from '../../components/Icons'
import { exportExcel, formatDate } from '../../lib/util'
import { useHousing } from '../../lib/housing'
import type { Role, StudentRow } from '../../../shared/types'

const PAGE = 50

export default function Students() {
  const { can } = useAuth()
  const housing = useHousing()
  const [f, setF] = useState({ q: '', buildingId: '', status: '' })
  const [page, setPage] = useState(1)
  const qs = new URLSearchParams({ ...f, page: String(page), pageSize: String(PAGE) })
  const list = useApi<{ rows: StudentRow[]; total: number }>(`/students?${qs}`)
  const [editing, setEditing] = useState<StudentRow | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { error, run } = useAction()

  const setFilter = (patch: Partial<typeof f>) => (setF({ ...f, ...patch }), setPage(1))
  const act = (fn: () => Promise<unknown>) => run(async () => (await fn(), list.reload()))

  const sendLink = (s: StudentRow) =>
    run(async () => {
      const r = await api<{ sent: boolean; link?: string }>(`/students/${s.id}/send-link`, { body: {} })
      setNotice(r.sent ? `تم إرسال رابط ${s.activated ? 'إعادة التعيين' : 'التفعيل'} إلى ${s.email}` : `خدمة البريد غير مفعلة. انسخ هذا الرابط وأرسله للطالب (صالح 60 دقيقة):\n${r.link}`)
    })

  return (
    <>
      <PageTitle
        title="الطلاب"
        sub={list.data ? `${list.data.total} طالب` : undefined}
        actions={
          <>
            {can('students.import') && <button className="btn-ghost" onClick={() => setImporting(true)}><IconUpload width={16} /> استيراد Excel</button>}
            {can('students.create') && <button className="btn-primary" onClick={() => setEditing('new')}><IconPlus width={16} /> إضافة طالب</button>}
          </>
        }
      />

      <div className="card mb-4 grid gap-2 p-3 sm:grid-cols-4">
        <input className="input sm:col-span-2" placeholder="بحث بالاسم أو البريد أو الرقم الجامعي…" value={f.q} onChange={(e) => setFilter({ q: e.target.value })} />
        <select className="input" value={f.buildingId} onChange={(e) => setFilter({ buildingId: e.target.value })} aria-label="المبنى">
          <option value="">كل المباني</option>
          {housing.data?.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input" value={f.status} onChange={(e) => setFilter({ status: e.target.value })} aria-label="الحالة">
          <option value="">كل الحالات</option>
          <option value="inactive">لم يفعّل حسابه</option>
          <option value="suspended">موقوف</option>
          <option value="blocked">ممنوع من البلاغات</option>
          <option value="noroom">بدون غرفة</option>
        </select>
      </div>

      {notice && (
        <div className="mb-4 flex items-start gap-3 whitespace-pre-wrap break-all rounded-xl bg-brand-50 p-3 text-sm text-brand-800 ring-1 ring-brand-200">
          <span className="flex-1">{notice}</span>
          <button className="text-xs" onClick={() => setNotice(null)}>إخفاء</button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>

      <div className="card mt-2 overflow-hidden">
        {list.loading && !list.data ? <Loading /> : list.data?.rows.length === 0 ? <Empty>لا يوجد طلاب</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs text-ink-3">
                <tr>
                  <th className="px-3 py-2 text-start">الطالب</th>
                  <th className="px-3 py-2 text-start">الغرفة</th>
                  <th className="px-3 py-2 text-start">الحساب</th>
                  <th className="px-3 py-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.data?.rows.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-ink-3"><span dir="ltr">{s.email}</span> · {s.universityId ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{housing.roomLabel(s.roomId)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {s.status === 'suspended' ? <span className="chip bg-rose-50 text-rose-700 ring-rose-200">موقوف</span>
                          : s.activated ? <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">مفعّل</span>
                          : <span className="chip bg-white text-ink-3 ring-line">غير مفعّل</span>}
                        {s.requestsBlocked && <span className="chip bg-amber-50 text-amber-800 ring-amber-200">ممنوع من البلاغات</span>}
                      </div>
                      {s.lastLoginAt && <div className="mt-1 text-[11px] text-ink-3">آخر دخول {formatDate(s.lastLoginAt)}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {can('students.edit') && <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setEditing(s)}>تعديل</button>}
                        {can('students.send_link') && s.status === 'active' && (
                          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => sendLink(s)}><IconMail width={14} /> {s.activated ? 'رابط كلمة مرور' : 'رابط التفعيل'}</button>
                        )}
                        {can('students.suspend') && (
                          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => act(() => api(`/students/${s.id}/flags`, { method: 'PATCH', body: { status: s.status === 'active' ? 'suspended' : 'active' } }))}>
                            {s.status === 'active' ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                          </button>
                        )}
                        {can('students.block_requests') && (
                          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => act(() => api(`/students/${s.id}/flags`, { method: 'PATCH', body: { requestsBlocked: !s.requestsBlocked } }))}>
                            {s.requestsBlocked ? 'السماح بالبلاغات' : 'منع البلاغات'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pager page={page} total={list.data.total} pageSize={PAGE} onPage={setPage} />}
      </div>

      {editing && housing.data && (
        <StudentForm student={editing === 'new' ? null : editing} housing={housing.data} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), list.reload())} />
      )}
      {importing && <ImportStudents onClose={() => setImporting(false)} onDone={list.reload} />}
    </>
  )
}

function StudentForm({ student, housing, onClose, onSaved }: { student: StudentRow | null; housing: NonNullable<ReturnType<typeof useHousing>['data']>; onClose: () => void; onSaved: () => void }) {
  const { can } = useAuth()
  const roles = useApi<Role[]>('/roles')
  const [form, setForm] = useState({
    name: student?.name ?? '', email: student?.email ?? '', universityId: student?.universityId ?? '', phone: student?.phone ?? '',
    roomId: student?.roomId ?? null, roleId: student?.roleId ?? null,
  })
  const { busy, error, run } = useAction()
  const save = () =>
    run(async () => {
      await api(student ? `/students/${student.id}` : '/students', { method: student ? 'PATCH' : 'POST', body: form })
      onSaved()
    })
  const remove = () => run(async () => (await api(`/students/${student!.id}`, { method: 'DELETE' }), onSaved()))

  return (
    <Modal title={student ? 'تعديل طالب' : 'إضافة طالب'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="الاسم الكامل"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="البريد الإلكتروني" hint="يستخدمه الطالب للتفعيل والدخول"><input className="input" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="الرقم الجامعي"><input className="input" dir="ltr" value={form.universityId} onChange={(e) => setForm({ ...form, universityId: e.target.value })} /></Field>
          <Field label="الجوال"><input className="input" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Field label="الغرفة"><RoomPicker housing={housing} value={form.roomId} onChange={(roomId) => setForm({ ...form, roomId })} /></Field>
        <Field label="صلاحية الطالب" hint="اتركها على الافتراضي ما لم تحتج صلاحيات مختلفة لهذا الطالب">
          <select className="input" value={form.roleId ?? ''} onChange={(e) => setForm({ ...form, roleId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">الافتراضية</option>
            {roles.data?.filter((r) => r.kind === 'student').map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
          </select>
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2 pt-1">
          <button className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? 'جارِ الحفظ…' : 'حفظ'}</button>
          {student && can('students.delete') && <ConfirmButton onConfirm={remove}>حذف الطالب</ConfirmButton>}
        </div>
      </div>
    </Modal>
  )
}

// Accepts Arabic or English headers; building can be a name ("مبنى 3") or just a number.
const HEADERS: Record<string, string> = {
  'الاسم': 'name', 'اسم الطالب': 'name', name: 'name',
  'البريد': 'email', 'البريد الإلكتروني': 'email', 'الايميل': 'email', email: 'email',
  'الرقم الجامعي': 'universityId', 'university id': 'universityId',
  'الجوال': 'phone', 'رقم الجوال': 'phone', phone: 'phone',
  'المبنى': 'building', building: 'building',
  'الجناح': 'wing', wing: 'wing',
  'الغرفة': 'room', 'رقم الغرفة': 'room', room: 'room',
}

function ImportStudents({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; errors: { row: number; message: string }[] } | null>(null)
  const [progress, setProgress] = useState(0)
  const { busy, error, setError, run } = useAction()

  const readFile = async (file?: File) => {
    if (!file) return
    setError(null)
    setResult(null)
    try {
      const sheet = await readXlsxFile(file)
      const [head, ...body] = sheet
      const keys = head.map((h) => HEADERS[String(h ?? '').trim().toLowerCase()] ?? HEADERS[String(h ?? '').trim()])
      if (!keys.includes('name') || !keys.includes('email')) throw new Error('الملف لازم يحتوي عمودي «الاسم» و«البريد الإلكتروني» في الصف الأول')
      setRows(
        body
          .filter((r) => r.some((v) => v !== null && v !== ''))
          .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] == null ? null : String(r[i]).trim()]).filter(([k]) => k))),
      )
    } catch (e) {
      setError((e as Error).message || 'تعذر قراءة الملف')
    }
  }

  const template = () =>
    exportExcel('نموذج-استيراد-الطلاب.xlsx', [{ name: 'فهد محمد العتيبي', universityId: '441100123', email: 'student@qu.edu.sa', phone: '05xxxxxxxx', building: 'مبنى 1', wing: '2', room: '5' }], [
      { title: 'الاسم', value: (r) => r.name, width: 24 },
      { title: 'الرقم الجامعي', value: (r) => r.universityId, width: 14 },
      { title: 'البريد الإلكتروني', value: (r) => r.email, width: 26 },
      { title: 'الجوال', value: (r) => r.phone, width: 14 },
      { title: 'المبنى', value: (r) => r.building, width: 10 },
      { title: 'الجناح', value: (r) => r.wing, width: 8 },
      { title: 'الغرفة', value: (r) => r.room, width: 8 },
    ])

  return (
    <Modal title="استيراد الطلاب من Excel" onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <p className="text-ink-2">
          الأعمدة المطلوبة: <b>الاسم</b> و<b>البريد الإلكتروني</b>. الاختيارية: الرقم الجامعي، الجوال، المبنى، الجناح، الغرفة.
          الطالب الموجود مسبقاً (بنفس البريد) تُحدّث بياناته.
        </p>
        <button className="btn-ghost" onClick={template}><IconDownload width={16} /> تنزيل نموذج الملف</button>
        <input type="file" accept=".xlsx" className="input" onChange={(e) => readFile(e.target.files?.[0])} />
        {rows && !result && <p>تم قراءة <b>{rows.length}</b> صف. اضغط استيراد للحفظ.</p>}
        {result && (
          <div className="rounded-xl bg-canvas p-3">
            <p>تمت إضافة <b>{result.created}</b> وتحديث <b>{result.updated}</b>.</p>
            {result.errors.length > 0 && (
              <>
                <p className="mt-2 font-semibold text-rose-700">{result.errors.length} صف لم يُستورد:</p>
                <ul className="mt-1 max-h-48 overflow-y-auto text-xs text-ink-2">
                  {result.errors.map((e, i) => <li key={i}>صف {e.row}: {e.message}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <button
            className="btn-primary"
            disabled={!rows || busy || !!result}
            onClick={() =>
              run(async () => {
                // Batches keep each request well under the serverless time limit.
                const total = { created: 0, updated: 0, errors: [] as { row: number; message: string }[] }
                for (let i = 0; i < rows!.length; i += 250) {
                  const r = await api<typeof total>('/students/import', { body: { rows: rows!.slice(i, i + 250), offset: i } })
                  total.created += r.created
                  total.updated += r.updated
                  total.errors.push(...r.errors)
                  setProgress(Math.min(rows!.length, i + 250))
                }
                setResult(total)
                onDone()
              })
            }
          >
            {busy ? `جارِ الاستيراد… ${progress} / ${rows?.length}` : 'استيراد'}
          </button>
          <button className="btn-ghost" onClick={onClose}>إغلاق</button>
        </div>
        <p className="text-xs text-ink-3">بعد الاستيراد: أرسل للطلاب رابط الموقع، وكل طالب يفعّل حسابه بإدخال بريده من صفحة «تفعيل الحساب».</p>
      </div>
    </Modal>
  )
}
