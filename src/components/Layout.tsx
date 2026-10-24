import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store'
import { IconClipboard, IconHome, IconLogout, IconSettings, IconTrophy } from './Icons'

export function Logo({ className = '' }: { className?: string }) {
  return <img src="/icon.svg" alt="" className={`size-9 rounded-xl ${className}`} />
}

export default function Layout() {
  const { user, logout } = useStore()
  const nav = [
    { to: '/', label: 'الرئيسية', icon: IconHome, end: true },
    { to: '/units', label: 'التفتيش', icon: IconClipboard },
    { to: '/results', label: 'النتائج', icon: IconTrophy },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'الإدارة', icon: IconSettings }] : []),
  ]

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <div className="no-print bg-gold-400/25 px-4 py-1.5 text-center text-xs text-ink-2">
        نسخة تجريبية للعرض — البيانات محفوظة على هذا الجهاز فقط
      </div>
      <header className="no-print sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Logo />
          <div className="leading-tight">
            <div className="font-bold">تفتيش السكن الطلابي</div>
            <div className="text-xs text-ink-3">عمادة شؤون الطلاب</div>
          </div>
          <nav className="ms-6 hidden gap-1 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-canvas'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <div className="hidden text-end text-xs sm:block">
              <div className="font-semibold">{user?.name}</div>
              <div className="text-ink-3">{user?.role === 'admin' ? 'مدير النظام' : 'عضو لجنة التفتيش'}</div>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-ink-3 hover:bg-canvas" title="تسجيل الخروج" aria-label="تسجيل الخروج">
              <IconLogout />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <Outlet />
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-white md:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand-700' : 'text-ink-3'}`}
          >
            <n.icon />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
