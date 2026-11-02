import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import { ErrorText, Field, PageTitle, useAction } from '../../components/ui'
import { IconCheck, IconQr } from '../../components/Icons'
import { LOCATIONS, PROBLEM_TYPES, type Location, type ProblemType } from '../../../shared/constants'

export default function NewRequest() {
  const { me, can } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qrWing = Number(params.get('wing')) || undefined
  const qrLoc = params.get('loc') as Location | null
  const [location, setLocation] = useState<Location>(qrLoc && qrLoc in LOCATIONS ? qrLoc : 'room')
  const [problemType, setProblemType] = useState<ProblemType | null>(null)
  const [description, setDescription] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const { busy, error, setError, run } = useAction()
  const room = me?.room

  if (!can('portal.maintenance_create')) return <div className="card p-8 text-center text-ink-3">ليس لديك صلاحية رفع البلاغات</div>
  if (!room) return <div className="card p-8 text-center text-ink-3">لا توجد غرفة مسجلة لحسابك، راجع إدارة السكن</div>
  if (me.requestsBlocked) return <div className="card p-8 text-center text-amber-800">تم إيقاف استقبال البلاغات من حسابك، راجع إدارة السكن</div>
  const wrongWing = qrWing !== undefined && qrWing !== room.wingId

  if (done)
    return (
      <div className="card space-y-3 p-8 text-center">
        <IconCheck className="mx-auto size-12 text-brand-600" />
        <div className="text-lg font-bold">تم رفع البلاغ</div>
        <div>رقم البلاغ: <b className="font-mono" dir="ltr">{done}</b></div>
        <p className="text-sm text-ink-3">وصل إشعار للمشرف المختص، وبيوصلك إشعار عند كل تحديث.</p>
        <div className="flex justify-center gap-2">
          <Link to="/student/requests" className="btn-primary">متابعة بلاغاتي</Link>
          <Link to="/student" className="btn-ghost">الرئيسية</Link>
        </div>
      </div>
    )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!problemType) return setError('اختر نوع المشكلة')
    run(async () => {
      const r = await api<{ sr: string }>('/maintenance', { body: { location, problemType, description, qrWingId: qrWing } })
      setDone(r.sr)
    })
  }

  return (
    <>
      <PageTitle title="بلاغ صيانة جديد" />
      {qrWing && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-sm ring-1 ${wrongWing ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-brand-50 text-brand-800 ring-brand-200'}`}>
          <IconQr width={18} /> {wrongWing ? 'هذا الباركود لجناح آخر غير جناحك. البلاغ يكون لجناحك فقط.' : 'تم تعبئة المكان من الباركود'}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="card space-y-1 p-4 text-sm">
          <div className="text-xs text-ink-3">بيانات الطالب</div>
          <div className="font-semibold">{me.name}</div>
          <div className="text-ink-2">{me.universityId ?? '—'} · {room.buildingName} · جناح {room.wingNumber} · غرفة {room.roomNumber}</div>
        </div>

        <div className="card space-y-4 p-4">
          <Field label="مكان المشكلة">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(Object.keys(LOCATIONS) as Location[]).map((l) => (
                <button type="button" key={l} onClick={() => setLocation(l)} className={`rounded-xl px-2 py-2.5 text-sm font-medium ring-1 ${location === l ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink-2 ring-line'}`}>
                  {LOCATIONS[l]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="نوع المشكلة">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(Object.keys(PROBLEM_TYPES) as ProblemType[]).map((t) => (
                <button type="button" key={t} onClick={() => setProblemType(t)} className={`rounded-xl px-2 py-2.5 text-sm font-medium ring-1 ${problemType === t ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink-2 ring-line'}`}>
                  {PROBLEM_TYPES[t]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="وصف مختصر للمشكلة">
            <textarea className="input min-h-28" required minLength={5} maxLength={1000} placeholder="يرجى وصف المشكلة بالتفصيل…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <button className="btn-primary flex-1 py-3 text-base" disabled={busy || wrongWing}>{busy ? 'جارِ الإرسال…' : 'إرسال'}</button>
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>إلغاء</button>
          </div>
        </div>
      </form>
    </>
  )
}
