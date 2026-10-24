import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { Logo } from '../components/Layout'
import { IconChevron, IconEye } from '../components/Icons'

export default function Login() {
  const { db, login } = useStore()
  const admins = db.members.filter((m) => m.role === 'admin')
  const inspectors = db.members.filter((m) => m.role === 'inspector')

  const Group = ({ title, list }: { title: string; list: typeof db.members }) => (
    <div>
      <div className="mb-2 text-xs font-semibold text-ink-3">{title}</div>
      <div className="space-y-2">
        {list.map((m) => (
          <button key={m.id} onClick={() => login(m.id)} className="card flex w-full items-center gap-3 p-3 text-start transition hover:ring-brand-200">
            <span className="grid size-10 place-items-center rounded-full bg-brand-50 font-bold text-brand-700">{m.name.replace(/^(أ\.|د\.)\s*/, '').charAt(0)}</span>
            <span className="font-medium">{m.name}</span>
            <IconChevron className="ms-auto text-ink-3" />
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-canvas px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <Logo className="mx-auto size-14" />
          <h1 className="mt-4 text-2xl font-bold">تفتيش السكن الطلابي</h1>
          <p className="mt-1 text-sm text-ink-3">جائزة أفضل غرفة وأفضل جناح — عمادة شؤون الطلاب</p>
        </div>

        <div className="card space-y-5 p-5">
          <div className="rounded-xl bg-gold-400/20 p-3 text-xs leading-relaxed text-ink-2">
            نسخة تجريبية: اختر المستخدم للدخول مباشرة. النسخة النهائية يكون الدخول فيها بحساب وكلمة مرور.
          </div>
          <Group title="الإدارة" list={admins} />
          {inspectors.length > 0 && <Group title="لجنة التفتيش" list={inspectors} />}
        </div>

        <Link to="/public" className="btn-ghost mt-4 w-full">
          <IconEye /> عرض النتائج المعلنة للطلاب
        </Link>
      </div>
    </div>
  )
}
