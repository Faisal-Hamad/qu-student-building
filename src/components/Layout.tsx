import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api, useApi } from '../api'
import { timeAgo } from '../lib/util'
import type { Notification } from '../../shared/types'
import {
  IconBell, IconBuilding, IconClipboard, IconHome, IconKey, IconList, IconLock, IconLogout, IconMenu, IconSettings, IconTrophy,
  IconUser, IconUsers, IconWrench, IconX,
} from './Icons'

export function Logo({ className = '' }: { className?: string }) {
  return <img src="/icon.svg" alt="" className={`size-9 rounded-xl ${className}`} />
}

function Bell() {
  const [open, setOpen] = useState(false)
  const { data, reload } = useApi<{ rows: Notification[]; unread: number }>('/notifications')
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  // Refresh every minute so new requests show up without reloading the page.
  useEffect(() => {
    const t = setInterval(reload, 60_000)
    return () => clearInterval(t)
  }, [reload])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const openItem = async (n: Notification) => {
    setOpen(false)
    if (!n.readAt) await api('/notifications/read', { body: { ids: [n.id] } }).catch(() => {})
    reload()
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-ink-2 hover:bg-canvas" aria-label="الإشعارات">
        <IconBell />
        {!!data?.unread && (
          <span className="absolute -top-0.5 -end-0.5 grid min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-bold">الإشعارات</span>
            {!!data?.unread && (
              <button className="text-xs font-medium text-brand-700" onClick={async () => (await api('/notifications/read', { body: {} }), reload())}>
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {data?.rows.length === 0 && <li className="p-6 text-center text-sm text-ink-3">لا توجد إشعارات</li>}
            {data?.rows.map((n) => (
              <li key={n.id}>
                <button onClick={() => openItem(n)} className={`block w-full px-4 py-3 text-start text-sm hover:bg-canvas ${n.readAt ? '' : 'bg-brand-50/60'}`}>
                  <div className="font-semibold">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-xs text-ink-2">{n.body}</div>}
                  <div className="mt-1 text-[11px] text-ink-3">{timeAgo(n.createdAt)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const STAFF_NAV = [
  { to: '/admin', label: 'لوحة التحكم', icon: IconHome, perm: ['dashboard.view'], end: true },
  { to: '/admin/maintenance', label: 'بلاغات الصيانة', icon: IconWrench, perm: ['maintenance.list'] },
  { to: '/admin/inspections', label: 'التفتيش', icon: IconClipboard, perm: ['inspections.list'] },
  { to: '/admin/results', label: 'النتائج والجوائز', icon: IconTrophy, perm: ['results.view'] },
  { to: '/admin/students', label: 'الطلاب', icon: IconUsers, perm: ['students.list'] },
  { to: '/admin/staff', label: 'الموظفين', icon: IconUser, perm: ['staff.list'] },
  { to: '/admin/roles', label: 'الصلاحيات', icon: IconLock, perm: ['roles.list'] },
  { to: '/admin/housing', label: 'المباني والغرف', icon: IconBuilding, perm: ['housing.list'] },
  { to: '/admin/activity', label: 'سجل الأنشطة', icon: IconList, perm: ['activity.view'] },
  { to: '/admin/settings', label: 'الإعدادات', icon: IconSettings, perm: ['settings.manage', 'settings.backup', 'inspections.criteria', 'results.publish'] },
]

export function StaffLayout() {
  const { me, can, logout } = useAuth()
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  useEffect(() => setDrawer(false), [location.pathname])
  const nav = STAFF_NAV.filter((n) => can(...n.perm))

  const sidebar = (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white text-brand-800 shadow-sm' : 'text-white/85 hover:bg-white/10'}`
          }
        >
          <n.icon width={18} height={18} />
          {n.label}
        </NavLink>
      ))}
      <NavLink to="/admin/account" className={({ isActive }) => `mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-white text-brand-800' : 'text-white/85 hover:bg-white/10'}`}>
        <IconKey width={18} height={18} /> حسابي
      </NavLink>
    </nav>
  )

  return (
    <div className="min-h-dvh md:flex">
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto bg-brand-800 md:block">
        <div className="flex items-center gap-3 px-5 py-5 text-white">
          <Logo className="bg-white/10" />
          <div className="leading-tight">
            <div className="font-bold">السكن الطلابي</div>
            <div className="text-xs text-white/60">لوحة المشرفين</div>
          </div>
        </div>
        {sidebar}
      </aside>

      {drawer && (
        <div className="no-print fixed inset-0 z-40 md:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 start-0 w-72 overflow-y-auto bg-brand-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 text-white">
              <span className="font-bold">القائمة</span>
              <button onClick={() => setDrawer(false)} aria-label="إغلاق"><IconX /></button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3">
            <button className="rounded-lg p-2 text-ink-2 md:hidden" onClick={() => setDrawer(true)} aria-label="القائمة"><IconMenu /></button>
            <div className="text-sm md:hidden"><b>السكن الطلابي</b></div>
            <div className="ms-auto flex items-center gap-1">
              <Bell />
              <div className="hidden px-2 text-end text-xs sm:block">
                <div className="font-semibold">{me?.name}</div>
                <div className="text-ink-3">{me?.roleName ?? 'بدون صلاحية'}</div>
              </div>
              <button onClick={logout} className="rounded-lg p-2 text-ink-3 hover:bg-canvas" title="تسجيل الخروج" aria-label="تسجيل الخروج"><IconLogout /></button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function StudentLayout() {
  const { me, can, logout } = useAuth()
  const nav = [
    { to: '/student', label: 'الرئيسية', icon: IconHome, end: true, show: true },
    { to: '/student/requests', label: 'بلاغاتي', icon: IconWrench, show: can('portal.maintenance_view', 'portal.maintenance_create') },
    { to: '/student/results', label: 'الجوائز', icon: IconTrophy, show: can('portal.results_view') },
    { to: '/student/account', label: 'حسابي', icon: IconUser, show: true },
  ].filter((n) => n.show)

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Logo />
          <div className="leading-tight">
            <div className="font-bold">السكن الطلابي</div>
            <div className="text-xs text-ink-3">{me?.name}</div>
          </div>
          <nav className="ms-6 hidden gap-1 md:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-canvas'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <Bell />
            <button onClick={logout} className="rounded-lg p-2 text-ink-3 hover:bg-canvas" aria-label="تسجيل الخروج"><IconLogout /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-white md:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand-700' : 'text-ink-3'}`}>
            <n.icon />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function AuthShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-canvas px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 block text-center">
          <Logo className="mx-auto size-14" />
          <h1 className="mt-4 text-2xl font-bold">{title}</h1>
          {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
        </Link>
        {children}
      </div>
    </div>
  )
}
