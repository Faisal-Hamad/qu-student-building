import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { demoDB, emptyDB, uid } from '../lib/seed'
import { download, sar } from '../lib/util'
import type { DB, Section } from '../lib/types'
import { PageTitle } from '../components/ui'
import { IconDownload, IconEye, IconPlus, IconTrash } from '../components/Icons'

const TABS = [
  { id: 'criteria', label: 'المعايير' },
  { id: 'housing', label: 'السكن' },
  { id: 'members', label: 'اللجنة' },
  { id: 'settings', label: 'الجوائز والإعلان' },
  { id: 'data', label: 'البيانات' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function Admin() {
  const [tab, setTab] = useState<Tab>('criteria')
  return (
    <>
      <PageTitle title="الإدارة" sub="تعديل المعايير والسكن واللجنة والجوائز" />
      <div className="no-print -mx-4 mb-5 overflow-x-auto px-4">
        <div className="inline-flex gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.id ? 'bg-brand-700 text-white' : 'text-ink-2'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'criteria' && <Criteria />}
      {tab === 'housing' && <Housing />}
      {tab === 'members' && <Members />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'data' && <DataTab />}
    </>
  )
}

function Panel({ title, sub, children, actions }: { title?: string; sub?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card mb-4 p-4">
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-bold">{title}</h2>
            {sub && <p className="text-xs text-ink-3">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

/* ---------- Criteria ---------- */

function Criteria() {
  const { db, update } = useStore()

  const editor = (key: 'roomTemplate' | 'wingTemplate', sections: Section[], allowSections: boolean) =>
    sections.map((s, si) => (
      <div key={s.id} className="mb-3 rounded-xl ring-1 ring-line">
        <div className="flex items-center gap-2 border-b border-line bg-canvas/60 p-2">
          <input
            className="input bg-white font-bold"
            value={s.label}
            onChange={(e) => update((d) => void (d[key][si].label = e.target.value))}
            aria-label="اسم القسم"
          />
          {allowSections && (
            <button className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label="حذف القسم" onClick={() => update((d) => void d[key].splice(si, 1))}>
              <IconTrash />
            </button>
          )}
        </div>
        <ul className="space-y-2 p-2">
          {s.criteria.map((c, ci) => (
            <li key={c.id} className="flex items-center gap-2">
              <input className="input" value={c.label} onChange={(e) => update((d) => void (d[key][si].criteria[ci].label = e.target.value))} aria-label="المعيار" />
              <select
                className="input w-24 shrink-0"
                value={c.weight}
                onChange={(e) => update((d) => void (d[key][si].criteria[ci].weight = Number(e.target.value)))}
                aria-label="الوزن"
              >
                {[1, 2, 3].map((w) => <option key={w} value={w}>وزن ×{w}</option>)}
              </select>
              <button className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label="حذف المعيار" onClick={() => update((d) => void d[key][si].criteria.splice(ci, 1))}>
                <IconTrash />
              </button>
            </li>
          ))}
        </ul>
        <button className="m-2 mt-0 inline-flex items-center gap-1 text-sm font-medium text-brand-700" onClick={() => update((d) => void d[key][si].criteria.push({ id: uid(), label: 'معيار جديد', weight: 1 }))}>
          <IconPlus width={16} /> إضافة معيار
        </button>
      </div>
    ))

  return (
    <>
      <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
        كل معيار يُقيّم من 0 إلى {db.settings.maxScore}. الوزن ×2 يعني أن المعيار يُحسب ضعف غيره. إضافة معيار بعد بدء التفتيش تجعل التقييمات السابقة ناقصة حتى يُعاد تقييمها.
      </div>
      <Panel title="معايير الغرفة">{editor('roomTemplate', db.roomTemplate, false)}</Panel>
      <Panel
        title="معايير الجناح"
        sub="الجناح مقسم إلى أقسام، ولكل قسم معاييره"
        actions={
          <button className="btn-ghost" onClick={() => update((d) => void d.wingTemplate.push({ id: uid(), label: 'قسم جديد', criteria: [] }))}>
            <IconPlus width={16} /> قسم جديد
          </button>
        }
      >
        {editor('wingTemplate', db.wingTemplate, true)}
      </Panel>
    </>
  )
}

/* ---------- Housing ---------- */

function removeInspectionsFor(d: DB, ids: Set<string>) {
  d.inspections = d.inspections.filter((i) => !ids.has(i.targetId))
}

function Housing() {
  const { db, update } = useStore()
  const [open, setOpen] = useState<string | null>(null)

  const addBuilding = () => update((d) => void d.buildings.push({ id: uid(), name: `مبنى ${d.buildings.length + 1}` }))
  const delBuilding = (id: string) =>
    update((d) => {
      const wingIds = new Set(d.wings.filter((w) => w.buildingId === id).map((w) => w.id))
      const roomIds = new Set(d.rooms.filter((r) => wingIds.has(r.wingId)).map((r) => r.id))
      removeInspectionsFor(d, new Set([...wingIds, ...roomIds]))
      d.rooms = d.rooms.filter((r) => !roomIds.has(r.id))
      d.wings = d.wings.filter((w) => !wingIds.has(w.id))
      d.buildings = d.buildings.filter((b) => b.id !== id)
    })
  const addWing = (buildingId: string) =>
    update((d) => {
      const n = d.wings.filter((w) => w.buildingId === buildingId).length + 1
      d.wings.push({ id: uid(), buildingId, name: `جناح جديد ${n}` })
    })
  const delWing = (id: string) =>
    update((d) => {
      const roomIds = new Set(d.rooms.filter((r) => r.wingId === id).map((r) => r.id))
      removeInspectionsFor(d, new Set([id, ...roomIds]))
      d.rooms = d.rooms.filter((r) => r.wingId !== id)
      d.wings = d.wings.filter((w) => w.id !== id)
    })
  const addRoom = (wingId: string) =>
    update((d) => {
      const n = d.rooms.filter((r) => r.wingId === wingId).length + 1
      d.rooms.push({ id: uid(), wingId, name: String(n), students: [] })
    })
  const delRoom = (id: string) =>
    update((d) => {
      removeInspectionsFor(d, new Set([id]))
      d.rooms = d.rooms.filter((r) => r.id !== id)
    })

  return (
    <>
      <p className="mb-4 text-sm text-ink-3">
        {db.buildings.length} مبانٍ · {db.wings.length} جناح · {db.rooms.length} غرفة. حذف جناح أو غرفة يحذف تقييماتها.
      </p>
      {db.buildings.map((b) => (
        <Panel key={b.id}>
          <div className="mb-3 flex items-center gap-2">
            <input className="input font-bold" value={b.name} onChange={(e) => update((d) => void (d.buildings.find((x) => x.id === b.id)!.name = e.target.value))} aria-label="اسم المبنى" />
            <button className="btn-danger shrink-0" onClick={() => delBuilding(b.id)}><IconTrash width={16} /> حذف المبنى</button>
          </div>
          <div className="space-y-2">
            {db.wings.filter((w) => w.buildingId === b.id).map((w) => {
              const rooms = db.rooms.filter((r) => r.wingId === w.id)
              const isOpen = open === w.id
              return (
                <div key={w.id} className="rounded-xl ring-1 ring-line">
                  <div className="flex items-center gap-2 p-2">
                    <span className="text-sm text-ink-3">جناح</span>
                    <input className="input" value={w.name} onChange={(e) => update((d) => void (d.wings.find((x) => x.id === w.id)!.name = e.target.value))} aria-label="اسم الجناح" />
                    <button className="btn-ghost shrink-0" onClick={() => setOpen(isOpen ? null : w.id)}>{rooms.length} غرف {isOpen ? '▴' : '▾'}</button>
                    <button className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label="حذف الجناح" onClick={() => delWing(w.id)}><IconTrash /></button>
                  </div>
                  {isOpen && (
                    <div className="space-y-2 border-t border-line p-2">
                      {rooms.map((r) => (
                        <div key={r.id} className="grid gap-2 rounded-lg bg-canvas p-2 sm:grid-cols-[8rem_1fr_auto]">
                          <input className="input" value={r.name} onChange={(e) => update((d) => void (d.rooms.find((x) => x.id === r.id)!.name = e.target.value))} aria-label="رقم الغرفة" />
                          <input
                            className="input"
                            placeholder="أسماء الطلاب، افصل بينها بفاصلة"
                            defaultValue={r.students.join('، ')}
                            onBlur={(e) => update((d) => void (d.rooms.find((x) => x.id === r.id)!.students = e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean)))}
                            aria-label="الطلاب"
                          />
                          <button className="justify-self-end rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label="حذف الغرفة" onClick={() => delRoom(r.id)}><IconTrash /></button>
                        </div>
                      ))}
                      <button className="inline-flex items-center gap-1 text-sm font-medium text-brand-700" onClick={() => addRoom(w.id)}><IconPlus width={16} /> إضافة غرفة</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700" onClick={() => addWing(b.id)}><IconPlus width={16} /> إضافة جناح</button>
        </Panel>
      ))}
      <button className="btn-primary" onClick={addBuilding}><IconPlus width={16} /> إضافة مبنى</button>
    </>
  )
}

/* ---------- Members ---------- */

function Members() {
  const { db, user, update } = useStore()
  const [name, setName] = useState('')
  const add = () => {
    if (!name.trim()) return
    update((d) => void d.members.push({ id: uid(), name: name.trim(), role: 'inspector' }))
    setName('')
  }
  return (
    <Panel title="أعضاء لجنة التفتيش" sub="مدير النظام يعدل كل شيء، وعضو اللجنة يفتش ويشوف النتائج فقط">
      <ul className="mb-3 space-y-2">
        {db.members.map((m, i) => (
          <li key={m.id} className="flex items-center gap-2">
            <input className="input" value={m.name} onChange={(e) => update((d) => void (d.members[i].name = e.target.value))} aria-label="الاسم" />
            <select
              className="input w-36 shrink-0"
              value={m.role}
              disabled={m.id === user?.id}
              onChange={(e) => update((d) => void (d.members[i].role = e.target.value as 'admin' | 'inspector'))}
              aria-label="الصلاحية"
            >
              <option value="admin">مدير النظام</option>
              <option value="inspector">عضو لجنة</option>
            </select>
            <button className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-30" disabled={m.id === user?.id} aria-label="حذف العضو" onClick={() => update((d) => void d.members.splice(i, 1))}>
              <IconTrash />
            </button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input className="input" placeholder="اسم العضو الجديد" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" type="submit"><IconPlus width={16} /> إضافة</button>
      </form>
    </Panel>
  )
}

/* ---------- Settings ---------- */

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-ink-2">{label}</span>
      <div className="flex items-center gap-2">
        <input type="number" min={0} className="input" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
        <span className="shrink-0 text-sm text-ink-3">{suffix}</span>
      </div>
    </label>
  )
}

function SettingsTab() {
  const { db, update } = useStore()
  const s = db.settings
  const set = <K extends keyof DB['settings']>(k: K, v: DB['settings'][K]) => update((d) => void (d.settings[k] = v))
  return (
    <>
      <Panel title="الجوائز" sub={`الإجمالي: ${sar(s.roomPrizeCount * s.roomPrizeAmount + s.wingPrizeCount * s.wingPrizeAmount)}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="عدد الغرف الفائزة" value={s.roomPrizeCount} onChange={(n) => set('roomPrizeCount', n)} suffix="غرف" />
          <NumberField label="جائزة كل غرفة" value={s.roomPrizeAmount} onChange={(n) => set('roomPrizeAmount', n)} suffix="ريال" />
          <NumberField label="عدد الأجنحة الفائزة" value={s.wingPrizeCount} onChange={(n) => set('wingPrizeCount', n)} suffix="أجنحة" />
          <NumberField label="جائزة كل جناح" value={s.wingPrizeAmount} onChange={(n) => set('wingPrizeAmount', n)} suffix="ريال" />
        </div>
      </Panel>
      <Panel title="إعلان النتائج للطلاب">
        <label className="flex items-center gap-3">
          <input type="checkbox" className="size-5 accent-brand-700" checked={s.publicResults} onChange={(e) => set('publicResults', e.target.checked)} />
          <span className="text-sm">إظهار الفائزين في صفحة النتائج العامة (بدون أسماء الطلاب ودرجات البقية)</span>
        </label>
        <Link to="/public" className="btn-ghost mt-3"><IconEye width={16} /> فتح صفحة النتائج العامة</Link>
      </Panel>
    </>
  )
}

/* ---------- Data ---------- */

function DataTab() {
  const { db, replace } = useStore()
  const [msg, setMsg] = useState('')
  const [armed, setArmed] = useState<'demo' | 'empty' | null>(null)

  const confirmThen = (kind: 'demo' | 'empty', fn: () => void) => {
    if (armed !== kind) return setArmed(kind)
    fn()
    setArmed(null)
    setMsg('تم')
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as DB
      if (data.version !== 1 || !Array.isArray(data.rooms) || !Array.isArray(data.inspections)) throw new Error()
      replace(data)
      setMsg('تم استيراد النسخة الاحتياطية')
    } catch {
      setMsg('الملف غير صالح')
    }
  }

  return (
    <>
      <Panel title="النسخ الاحتياطي" sub="البيانات في النسخة التجريبية محفوظة في هذا المتصفح فقط. صدّرها لنقلها لجهاز آخر.">
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => download(`sakan-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db), 'application/json')}>
            <IconDownload width={16} /> تصدير نسخة احتياطية
          </button>
          <label className="btn-ghost cursor-pointer">
            استيراد نسخة احتياطية
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </Panel>
      <Panel title="إعادة التعيين">
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => confirmThen('demo', () => replace(demoDB()))}>
            {armed === 'demo' ? 'اضغط مرة ثانية للتأكيد' : 'استرجاع البيانات التجريبية'}
          </button>
          <button className="btn-danger" onClick={() => confirmThen('empty', () => replace({ ...emptyDB(), members: db.members, roomTemplate: db.roomTemplate, wingTemplate: db.wingTemplate, settings: db.settings }))}>
            {armed === 'empty' ? 'اضغط مرة ثانية للتأكيد' : 'مسح السكن والتقييمات والبدء من الصفر'}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-3">المسح يبقي المعايير واللجنة والإعدادات، ويحذف المباني والغرف والتقييمات.</p>
      </Panel>
      {msg && <p className="text-sm text-brand-700">{msg}</p>}
    </>
  )
}
