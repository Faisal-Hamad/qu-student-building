import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, useApi } from '../../api'
import { useAuth } from '../../auth'
import { AuthShell } from '../../components/Layout'
import { ErrorText, Field, Loading, useAction } from '../../components/ui'
import { IconCheck, IconMail } from '../../components/Icons'
import { MIN_PASSWORD } from '../../../shared/constants'

export function Login() {
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, error, run } = useAction()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      await api('/auth/login', { body: { email, password } })
      await refresh()
    })
  }

  return (
    <AuthShell title="نظام السكن الطلابي" sub="بلاغات الصيانة · التفتيش · جائزة أفضل غرفة وجناح">
      <form onSubmit={submit} className="card space-y-4 p-5">
        <Field label="البريد الإلكتروني">
          <input className="input" type="email" autoComplete="username" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="كلمة المرور">
          <input className="input" type="password" autoComplete="current-password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارِ الدخول…' : 'تسجيل الدخول'}</button>
        <div className="flex justify-between text-sm">
          <Link to="/activate" className="font-medium text-brand-700">أول مرة؟ فعّل حسابك</Link>
          <Link to="/activate?forgot=1" className="text-ink-3">نسيت كلمة المرور</Link>
        </div>
      </form>
      <Link to="/results" className="btn-ghost mt-4 w-full">عرض الفائزين بجائزة أفضل غرفة وجناح</Link>
    </AuthShell>
  )
}

export function RequestLink() {
  const [params] = useSearchParams()
  const forgot = params.has('forgot')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { busy, error, run } = useAction()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      await api('/auth/email-link', { body: { email } })
      setSent(true)
    })
  }

  return (
    <AuthShell title={forgot ? 'نسيت كلمة المرور' : 'تفعيل الحساب'} sub={forgot ? 'نرسل لك رابطاً لتعيين كلمة مرور جديدة' : 'أدخل بريدك المسجل لدى إدارة السكن'}>
      {sent ? (
        <div className="card space-y-3 p-6 text-center">
          <IconMail className="mx-auto size-10 text-brand-600" />
          <p className="font-semibold">إذا كان البريد مسجلاً لدينا فستصلك رسالة خلال دقائق.</p>
          <p className="text-sm text-ink-3">افتح الرابط في الرسالة لتعيين كلمة المرور. الرابط صالح لمدة 60 دقيقة. تأكد من مجلد الرسائل غير المرغوبة.</p>
          <Link to="/login" className="btn-ghost w-full">العودة لتسجيل الدخول</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-5">
          <Field label="البريد الإلكتروني" hint="البريد الذي سجلته إدارة السكن (غالباً البريد الجامعي)">
            <input className="input" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارِ الإرسال…' : 'إرسال الرابط'}</button>
          <Link to="/login" className="block text-center text-sm text-ink-3">العودة لتسجيل الدخول</Link>
        </form>
      )}
    </AuthShell>
  )
}

function PasswordFields({ onSubmit, busy, error, submitLabel }: { onSubmit: (pw: string) => void; busy: boolean; error: string | null; submitLabel: string }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const mismatch = pw2.length > 0 && pw !== pw2
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (pw === pw2) onSubmit(pw)
      }}
    >
      <Field label="كلمة المرور الجديدة" hint={`${MIN_PASSWORD} أحرف على الأقل`}>
        <input className="input" type="password" autoComplete="new-password" dir="ltr" minLength={MIN_PASSWORD} required value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="تأكيد كلمة المرور">
        <input className={`input ${mismatch ? 'border-rose-400' : ''}`} type="password" autoComplete="new-password" dir="ltr" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      {mismatch && <p className="text-xs text-rose-700">كلمتا المرور غير متطابقتين</p>}
      <ErrorText>{error}</ErrorText>
      <button className="btn-primary w-full" disabled={busy || mismatch}>{busy ? 'جارِ الحفظ…' : submitLabel}</button>
    </form>
  )
}

export function SetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const info = useApi<{ valid: boolean; purpose?: 'activate' | 'reset'; name?: string }>(token ? `/auth/token-info?token=${encodeURIComponent(token)}` : null)
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const { busy, error, run } = useAction()

  if (info.loading) return <AuthShell title="تعيين كلمة المرور"><Loading /></AuthShell>
  if (!token || !info.data?.valid)
    return (
      <AuthShell title="الرابط غير صالح">
        <div className="card space-y-3 p-6 text-center">
          <p className="text-sm text-ink-2">الرابط منتهي أو استُخدم من قبل. اطلب رابطاً جديداً.</p>
          <Link to="/activate" className="btn-primary w-full">طلب رابط جديد</Link>
        </div>
      </AuthShell>
    )

  return (
    <AuthShell title={info.data.purpose === 'activate' ? 'تفعيل الحساب' : 'كلمة مرور جديدة'} sub={`مرحباً ${info.data.name}`}>
      <div className="card p-5">
        <PasswordFields
          busy={busy}
          error={error}
          submitLabel={info.data.purpose === 'activate' ? 'تفعيل الحساب والدخول' : 'حفظ والدخول'}
          onSubmit={(password) =>
            run(async () => {
              await api('/auth/set-password', { body: { token, password } })
              await refresh()
              navigate('/', { replace: true })
            })
          }
        />
      </div>
    </AuthShell>
  )
}

export function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [done, setDone] = useState(false)
  const { busy, error, run } = useAction()
  return (
    <div className="card max-w-md space-y-4 p-5">
      <h2 className="font-bold">تغيير كلمة المرور</h2>
      {done && <p className="flex items-center gap-2 text-sm text-brand-700"><IconCheck width={16} /> تم تغيير كلمة المرور</p>}
      <Field label="كلمة المرور الحالية">
        <input className="input" type="password" autoComplete="current-password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <PasswordFields
        busy={busy}
        error={error}
        submitLabel="حفظ كلمة المرور"
        onSubmit={(next) => run(async () => (await api('/auth/change-password', { body: { current, next } }), setDone(true), setCurrent('')))}
      />
    </div>
  )
}

export function Setup() {
  const status = useApi<{ needed: boolean; enabled: boolean }>('/setup')
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ token: '', name: '', email: '' })
  const { busy, error, run } = useAction()

  if (status.loading) return <AuthShell title="إعداد النظام"><Loading /></AuthShell>
  if (!status.data?.needed)
    return (
      <AuthShell title="تم إعداد النظام">
        <Link to="/login" className="btn-primary w-full">تسجيل الدخول</Link>
      </AuthShell>
    )

  return (
    <AuthShell title="إعداد النظام" sub="إنشاء حساب مدير النظام (عميد شؤون الطلاب)">
      <div className="card space-y-4 p-5">
        {!status.data.enabled && <ErrorText>أضف المتغير SETUP_TOKEN في إعدادات Vercel ثم أعد النشر.</ErrorText>}
        <Field label="رمز الإعداد" hint="القيمة التي وضعتها في SETUP_TOKEN">
          <input className="input" dir="ltr" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
        </Field>
        <Field label="الاسم">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="البريد الإلكتروني">
          <input className="input" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <PasswordFields
          busy={busy}
          error={error}
          submitLabel="إنشاء الحساب"
          onSubmit={(password) =>
            run(async () => {
              await api('/setup', { body: { ...form, password } })
              await refresh()
              navigate('/admin', { replace: true })
            })
          }
        />
      </div>
    </AuthShell>
  )
}
