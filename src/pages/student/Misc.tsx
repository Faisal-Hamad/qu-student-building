import { useAuth } from '../../auth'
import { PageTitle } from '../../components/ui'
import { WinnersBoard } from '../public/PublicResults'
import { ChangePassword } from '../public/Auth'

export function StudentResults() {
  return (
    <>
      <PageTitle title="جائزة أفضل غرفة وأفضل جناح" />
      <WinnersBoard />
    </>
  )
}

export function StudentAccount() {
  const { me, logout } = useAuth()
  const r = me?.room
  return (
    <>
      <PageTitle title="حسابي" />
      <div className="card mb-4 space-y-2 p-4 text-sm">
        <Row label="الاسم" value={me?.name} />
        <Row label="البريد" value={<span dir="ltr">{me?.email}</span>} />
        <Row label="الرقم الجامعي" value={me?.universityId ?? '—'} />
        <Row label="السكن" value={r ? `${r.buildingName} · جناح ${r.wingNumber} · غرفة ${r.roomNumber}` : '—'} />
        <p className="pt-1 text-xs text-ink-3">لتعديل بياناتك أو غرفتك راجع إدارة السكن.</p>
      </div>
      <ChangePassword />
      <button onClick={logout} className="btn-ghost mt-4">تسجيل الخروج</button>
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-3">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
