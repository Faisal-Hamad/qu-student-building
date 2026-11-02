import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { round1 } from '../../shared/scoring'
import { STATUSES, STATUS_TONE, type Status } from '../../shared/constants'
import { IconChevron, IconX } from './Icons'

export function scoreTone(p: number) {
  if (p >= 85) return 'text-emerald-700 bg-emerald-50 ring-emerald-200'
  if (p >= 70) return 'text-teal-700 bg-teal-50 ring-teal-200'
  if (p >= 50) return 'text-amber-700 bg-amber-50 ring-amber-200'
  return 'text-rose-700 bg-rose-50 ring-rose-200'
}

export function ScoreBadge({ percent, className = '' }: { percent: number; className?: string }) {
  return <span className={`chip ${scoreTone(percent)} ${className}`}>{round1(percent)}٪</span>
}

export function StatusChip({ status }: { status: Status }) {
  return <span className={`chip ${STATUS_TONE[status]}`}>{STATUSES[status]}</span>
}

export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-brand-50 ${className}`}>
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-3">{sub}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

// Back to the previous page; when the page was opened directly (notification, QR, shared link)
// there is no in-app history, so it goes to the section's main page instead of leaving the site.
export function BackLink({ fallback, label = 'رجوع', onClick }: { fallback: string; label?: string; onClick?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <button
      type="button"
      onClick={onClick ?? (() => (location.key === 'default' ? navigate(fallback) : navigate(-1)))}
      className="no-print mb-3 inline-flex items-center gap-1 rounded-lg py-1 text-sm font-medium text-ink-2 hover:text-brand-700"
    >
      <IconChevron className="rotate-180" width={16} height={16} /> {label}
    </button>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-2">{hint}</div>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-canvas" aria-label="إغلاق"><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{children}</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-ink-3">{children}</div>
}

export function Loading() {
  return <div className="py-10 text-center text-sm text-ink-3">جارِ التحميل…</div>
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
      <span className="text-ink-3">صفحة {page} من {pages} · {total} نتيجة</span>
      <div className="flex gap-2">
        <button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>السابق</button>
        <button className="btn-ghost px-3 py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>التالي</button>
      </div>
    </div>
  )
}

// Runs an async action with busy/error state; used by forms and buttons.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

// Two-tap confirm instead of window.confirm (keeps the UI consistent on phones).
export function ConfirmButton({ onConfirm, children, className = 'btn-danger', confirmText = 'اضغط مرة ثانية للتأكيد' }: { onConfirm: () => void; children: ReactNode; className?: string; confirmText?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button type="button" className={className} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmText : children}
    </button>
  )
}
