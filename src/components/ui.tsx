import type { ReactNode } from 'react'
import { round1, scoreTone } from '../lib/scoring'

export function ScoreBadge({ percent, className = '' }: { percent: number; className?: string }) {
  return <span className={`chip ${scoreTone(percent)} ${className}`}>{round1(percent)}٪</span>
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

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-2">{hint}</div>}
    </div>
  )
}
