import { useAuth } from '../../auth'
import { PageTitle } from '../../components/ui'
import { ChangePassword } from '../public/Auth'

export function AdminAccount() {
  const { me } = useAuth()
  return (
    <>
      <PageTitle title="حسابي" sub={`${me?.name} · ${me?.email} · ${me?.roleName ?? ''}`} />
      <ChangePassword />
    </>
  )
}
