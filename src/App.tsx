import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { StaffLayout, StudentLayout } from './components/Layout'
import { Login, RequestLink, SetPassword, Setup } from './pages/public/Auth'
import { PublicResults } from './pages/public/PublicResults'
import Dashboard from './pages/admin/Dashboard'
import Maintenance from './pages/admin/Maintenance'
import Inspections from './pages/admin/Inspections'
import Inspect from './pages/admin/Inspect'
import Results from './pages/admin/Results'
import Students from './pages/admin/Students'
import Staff from './pages/admin/Staff'
import Roles from './pages/admin/Roles'
import Housing from './pages/admin/Housing'
import QrSheet from './pages/admin/QrSheet'
import Activity from './pages/admin/Activity'
import SettingsPage from './pages/admin/Settings'
import { AdminAccount } from './pages/admin/Account'
import StudentHome from './pages/student/Home'
import NewRequest from './pages/student/NewRequest'
import MyRequests from './pages/student/MyRequests'
import { StudentAccount, StudentResults } from './pages/student/Misc'
import type { ReactNode } from 'react'

function Guard({ perm, children }: { perm: string[]; children: ReactNode }) {
  const { can } = useAuth()
  return can(...perm) ? <>{children}</> : <Navigate to="/admin" replace />
}

export default function App() {
  const { me } = useAuth()
  const home = !me ? '/login' : me.kind === 'staff' ? '/admin' : '/student'

  return (
    <Routes>
      <Route path="/results" element={<PublicResults />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/login" element={me ? <Navigate to={home} replace /> : <Login />} />
      <Route path="/activate" element={me ? <Navigate to={home} replace /> : <RequestLink />} />

      <Route path="/admin" element={me?.kind === 'staff' ? <StaffLayout /> : <Navigate to={home} replace />}>
        <Route index element={<Dashboard />} />
        <Route path="maintenance" element={<Guard perm={['maintenance.list']}><Maintenance /></Guard>} />
        <Route path="inspections" element={<Guard perm={['inspections.list']}><Inspections /></Guard>} />
        <Route path="inspect/:type/:id" element={<Guard perm={['inspections.list']}><Inspect /></Guard>} />
        <Route path="results" element={<Guard perm={['results.view']}><Results /></Guard>} />
        <Route path="students" element={<Guard perm={['students.list']}><Students /></Guard>} />
        <Route path="staff" element={<Guard perm={['staff.list']}><Staff /></Guard>} />
        <Route path="roles" element={<Guard perm={['roles.list']}><Roles /></Guard>} />
        <Route path="housing" element={<Guard perm={['housing.list']}><Housing /></Guard>} />
        <Route path="housing/qr/:wingId" element={<Guard perm={['housing.qr']}><QrSheet /></Guard>} />
        <Route path="activity" element={<Guard perm={['activity.view']}><Activity /></Guard>} />
        <Route path="settings" element={<Guard perm={['settings.manage', 'settings.backup', 'inspections.criteria', 'results.publish']}><SettingsPage /></Guard>} />
        <Route path="account" element={<AdminAccount />} />
      </Route>

      <Route path="/student" element={me?.kind === 'student' ? <StudentLayout /> : <Navigate to={home} replace />}>
        <Route index element={<StudentHome />} />
        <Route path="new" element={<NewRequest />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="results" element={<StudentResults />} />
        <Route path="account" element={<StudentAccount />} />
      </Route>

      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  )
}
