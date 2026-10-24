import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { latestInspection, round1, scoreInspection, scoreTone } from '../lib/scoring'
import { uid } from '../lib/seed'
import { compressImage, formatDate } from '../lib/util'
import type { Inspection, TargetType } from '../lib/types'
import { IconAlert, IconCamera, IconChevron, IconTrash, IconX } from '../components/Icons'

const SCALE_LABELS = ['سيئ جداً', 'سيئ', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز']
const MAX_PHOTOS = 6

// Keyed by unit so the form state resets when moving between units.
export default function InspectRoute() {
  const { type, id } = useParams<{ type: TargetType; id: string }>()
  return <Inspect key={`${type}/${id}`} type={type} id={id} />
}

function Inspect({ type, id }: { type?: TargetType; id?: string }) {
  const { db, user, update } = useStore()
  const navigate = useNavigate()

  const isRoom = type === 'room'
  const room = isRoom ? db.rooms.find((r) => r.id === id) : undefined
  const wing = isRoom ? db.wings.find((w) => w.id === room?.wingId) : db.wings.find((w) => w.id === id)
  const building = db.buildings.find((b) => b.id === wing?.buildingId)
  const templates = isRoom ? db.roomTemplate : db.wingTemplate
  const existing = type && id ? latestInspection(db, type, id) : undefined
  const max = db.settings.maxScore

  const [scores, setScores] = useState<Record<string, number>>(existing?.scores ?? {})
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? [])
  const [disqualified, setDisqualified] = useState(existing?.disqualified ?? false)
  const [reason, setReason] = useState(existing?.disqualifyReason ?? '')
  const [busy, setBusy] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const draft: Inspection = useMemo(
    () => ({
      id: existing?.id ?? uid(),
      targetType: type!,
      targetId: id!,
      scores,
      notes,
      disqualified,
      disqualifyReason: reason,
      photos,
      inspectorId: user!.id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    [existing, type, id, scores, notes, disqualified, reason, photos, user],
  )
  const result = scoreInspection(templates, draft, max)
  const allCriteria = templates.flatMap((s) => s.criteria)
  const scoredCount = allCriteria.filter((c) => scores[c.id] !== undefined).length

  if (!type || !id || (isRoom ? !room : !wing)) {
    return <div className="card p-8 text-center text-ink-3">الوحدة غير موجودة. <Link to="/units" className="text-brand-700">رجوع</Link></div>
  }

  const title = isRoom ? `غرفة ${room!.name} · جناح ${wing!.name}` : `جناح ${wing!.name}`
  const location = building?.name ?? ''

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    setBusy(true)
    try {
      const slots = MAX_PHOTOS - photos.length
      const imgs = await Promise.all([...files].slice(0, slots).map((f) => compressImage(f)))
      setPhotos((p) => [...p, ...imgs])
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (scoredCount < allCriteria.length || (disqualified && !reason.trim())) {
      setShowErrors(true)
      document.querySelector('[data-missing="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    update((d) => {
      d.inspections = d.inspections.filter((i) => !(i.targetType === type && i.targetId === id))
      d.inspections.push({ ...draft, notes: notes.trim(), disqualifyReason: disqualified ? reason.trim() : '' })
    })
    navigate('/units')
  }

  const remove = () => {
    if (!existing) return
    if (!confirmDelete) return setConfirmDelete(true)
    update((d) => {
      d.inspections = d.inspections.filter((i) => i.id !== existing.id)
    })
    navigate('/units')
  }

  return (
    <div className="pb-28">
      <Link to="/units" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-3">
        <IconChevron className="rotate-180" width={16} /> رجوع للتفتيش
      </Link>

      <div className="card mb-4 p-4">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <div className="text-sm text-ink-3">{location}</div>
          </div>
          {existing && <span className="chip ms-auto bg-brand-50 text-brand-700 ring-brand-200">تعديل تقييم سابق</span>}
        </div>
        {room && room.students.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {room.students.map((s) => (
              <span key={s} className="rounded-lg bg-canvas px-2 py-1 text-xs text-ink-2">{s}</span>
            ))}
          </div>
        )}
        {existing && (
          <div className="mt-3 text-xs text-ink-3">
            آخر حفظ: {db.members.find((m) => m.id === existing.inspectorId)?.name ?? '—'} · {formatDate(existing.updatedAt)}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
        {SCALE_LABELS.slice(0, max + 1).map((l, i) => (
          <span key={i}><b className="text-ink-2">{i}</b> {l}</span>
        ))}
      </div>

      <div className="space-y-4">
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

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">الصور <span className="text-xs font-normal text-ink-3">(اختياري، حتى {MAX_PHOTOS})</span></h2>
            <label className={`btn-ghost cursor-pointer ${photos.length >= MAX_PHOTOS || busy ? 'pointer-events-none opacity-50' : ''}`}>
              <IconCamera /> {busy ? 'جارِ المعالجة…' : 'إضافة صورة'}
              <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <button type="button" onClick={() => setPreview(p)} className="block aspect-square w-full overflow-hidden rounded-xl ring-1 ring-line">
                    <img src={p} alt="" className="size-full object-cover" />
                  </button>
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute -top-1.5 -start-1.5 grid size-6 place-items-center rounded-full bg-white text-rose-600 shadow ring-1 ring-line" aria-label="حذف الصورة">
                    <IconX width={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-3">لا توجد صور</p>
          )}
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

        {existing && user?.role === 'admin' && (
          <button onClick={remove} className="btn-danger w-full"><IconTrash /> {confirmDelete ? 'اضغط مرة ثانية لتأكيد الحذف' : 'حذف هذا التقييم'}</button>
        )}
      </div>

      <div className="no-print fixed inset-x-0 bottom-16 z-10 border-t border-line bg-white/95 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
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
          <button onClick={save} className="btn-primary ms-auto px-8">حفظ التقييم</button>
        </div>
      </div>

      {preview && (
        <button type="button" onClick={() => setPreview(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <img src={preview} alt="" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}
    </div>
  )
}
