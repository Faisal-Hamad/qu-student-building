import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, useApi } from '../../api'
import { useAuth } from '../../auth'
import { ConfirmButton, ErrorText, Loading, scoreTone, useAction } from '../../components/ui'
import { IconAlert, IconChevron, IconTrash } from '../../components/Icons'
import { formatDate } from '../../lib/util'
import { useHousing } from '../../lib/housing'
import { round1, scoreInspection } from '../../../shared/scoring'
import type { Inspection, Settings, TargetType } from '../../../shared/types'

const SCALE_LABELS = ['سيئ جداً', 'سيئ', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز']

// Keyed by unit so the form state resets when moving between units.
export default function InspectRoute() {
  const { type, id } = useParams<{ type: TargetType; id: string }>()
  const insp = useApi<Inspection[]>('/inspections')
  const settings = useApi<Settings>('/settings')
  const housing = useHousing()
  if (!insp.data || !settings.data || !housing.data) return <Loading />
  const existing = insp.data.find((i) => i.targetType === type && i.targetId === Number(id))
  return <InspectForm key={`${type}/${id}`} type={type!} id={Number(id)} existing={existing} settings={settings.data} housing={housing} />
}

function InspectForm({ type, id, existing, settings, housing }: { type: TargetType; id: number; existing?: Inspection; settings: Settings; housing: ReturnType<typeof useHousing> }) {
  const { can, me } = useAuth()
  const navigate = useNavigate()
  const isRoom = type === 'room'
  const templates = isRoom ? settings.roomTemplate : settings.wingTemplate
  const max = settings.maxScore
  const canEdit = can('inspections.inspect')

  const [scores, setScores] = useState<Record<string, number>>(existing?.scores ?? {})
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [disqualified, setDisqualified] = useState(existing?.disqualified ?? false)
  const [reason, setReason] = useState(existing?.disqualifyReason ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const { busy, error, run } = useAction()

  const result = scoreInspection(templates, scores, max)
  const allCriteria = templates.flatMap((s) => s.criteria)
  const scoredCount = allCriteria.filter((c) => scores[c.id] !== undefined).length

  const unit = isRoom ? housing.labels?.room(id) : housing.labels?.wing(id)
  if (!unit) return <div className="card p-8 text-center text-ink-3">الوحدة غير موجودة</div>

  const save = () => {
    if (scoredCount < allCriteria.length || (disqualified && !reason.trim())) {
      setShowErrors(true)
      document.querySelector('[data-missing="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    run(async () => {
      await api(`/inspections/${type}/${id}`, { method: 'PUT', body: { scores, notes, disqualified, disqualifyReason: reason } })
      navigate('/admin/inspections')
    })
  }

  const remove = () =>
    run(async () => {
      await api(`/inspections/${type}/${id}`, { method: 'DELETE' })
      navigate('/admin/inspections')
    })

  return (
    <div className="pb-28">
      <Link to="/admin/inspections" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-3">
        <IconChevron className="rotate-180" width={16} /> رجوع للتفتيش
      </Link>

      <div className="card mb-4 p-4">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-xl font-bold">{unit.name}</h1>
            <div className="text-sm text-ink-3">{unit.location} · الجولة {settings.currentRound}</div>
          </div>
          {existing && <span className="chip ms-auto bg-brand-50 text-brand-700 ring-brand-200">تعديل تقييم سابق</span>}
        </div>
        {existing && <div className="mt-3 text-xs text-ink-3">آخر حفظ: {existing.inspectorName ?? '—'} · {formatDate(existing.updatedAt)}</div>}
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
        {SCALE_LABELS.slice(0, max + 1).map((l, i) => <span key={i}><b className="text-ink-2">{i}</b> {l}</span>)}
      </div>

      <fieldset disabled={!canEdit} className="space-y-4">
        {templates.map((section, si) => {
          const sp = result.sections[si]
          return (
            <section key={section.id} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-canvas/60 px-4 py-3">
                <h2 className="font-bold">{section.label}</h2>
                {sp.percent !== null && <span className={`chip ${scoreTone(sp.percent)}`}>{round1(sp.percent)}٪</span>}
              </div>
              <ul className="divide-y divide-line">
                {section.criteria.map((c) => {
                  const missing = showErrors && scores[c.id] === undefined
                  return (
                    <li key={c.id} data-missing={missing} className={`px-4 py-3 ${missing ? 'bg-rose-50' : ''}`}>
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        {c.label}
                        {c.weight !== 1 && <span className="chip bg-gold-400/20 text-ink-2 ring-gold-400/40">وزن ×{c.weight}</span>}
                      </div>
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${max + 1}, minmax(0, 1fr))` }}>
                        {Array.from({ length: max + 1 }, (_, v) => {
                          const active = scores[c.id] === v
                          return (
                            <button
                              key={v}
                              type="button"
                              title={SCALE_LABELS[v]}
                              onClick={() => setScores((s) => ({ ...s, [c.id]: v }))}
                              className={`h-11 rounded-xl text-base font-bold ring-1 transition ${
                                active
                                  ? v >= max * 0.8 ? 'bg-brand-600 text-white ring-brand-600' : v >= max * 0.5 ? 'bg-amber-500 text-white ring-amber-500' : 'bg-rose-600 text-white ring-rose-600'
                                  : 'bg-white text-ink-2 ring-line hover:ring-brand-200'
                              }`}
                            >
                              {v}
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        <section className="card p-4">
          <label className="mb-2 block font-bold" htmlFor="notes">ملاحظات المفتش</label>
          <textarea id="notes" className="input min-h-24" placeholder="اكتب أي ملاحظة عن الحالة…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <section className={`card p-4 ${disqualified ? 'ring-rose-300' : ''}`}>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={disqualified} onChange={(e) => setDisqualified(e.target.checked)} className="size-5 accent-rose-600" />
            <span>
              <span className="font-bold">استبعاد من الجائزة</span>
              <span className="block text-xs text-ink-3">عند وجود مخالفة (ممنوعات، تلفيات متعمدة…)</span>
            </span>
          </label>
          {disqualified && (
            <textarea
              data-missing={showErrors && !reason.trim()}
              className={`input mt-3 ${showErrors && !reason.trim() ? 'border-rose-400' : ''}`}
              placeholder="سبب الاستبعاد (مطلوب)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </section>
      </fieldset>

      {existing && can('inspections.delete') && (
        <ConfirmButton onConfirm={remove} className="btn-danger mt-4 w-full"><IconTrash width={16} /> حذف هذا التقييم</ConfirmButton>
      )}
      <div className="mt-3"><ErrorText>{error}</ErrorText></div>

      {canEdit && (
        <div className="no-print fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 backdrop-blur md:start-64">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <div>
              <div className="text-xs text-ink-3">تم تقييم {scoredCount} من {allCriteria.length}</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{round1(result.percent)}٪</span>
                {disqualified && <span className="chip bg-rose-50 text-rose-700 ring-rose-200">مستبعد</span>}
              </div>
            </div>
            {showErrors && scoredCount < allCriteria.length && (
              <span className="hidden items-center gap-1 text-xs text-rose-700 sm:flex"><IconAlert width={16} /> أكمل المعايير المظللة</span>
            )}
            <button onClick={save} disabled={busy} className="btn-primary ms-auto px-8">{busy ? 'جارِ الحفظ…' : 'حفظ التقييم'}</button>
          </div>
        </div>
      )}
      {!canEdit && <p className="mt-4 text-center text-sm text-ink-3">عرض فقط — ليس لديك صلاحية التقييم ({me?.roleName})</p>}
    </div>
  )
}
