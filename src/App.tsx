import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Units from './pages/Units'
import Inspect from './pages/Inspect'
import Results from './pages/Results'
import PublicResults from './pages/PublicResults'
import Admin from './pages/Admin'

export default function App() {
  const { user } = useStore()
  return (
    <Routes>
      <Route path="/public" element={<PublicResults />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Home />} />
        <Route path="units" element={<Units />} />
        <Route path="inspect/:type/:id" element={<Inspect />} />
        <Route path="results" element={<Results />} />
        <Route path="admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
