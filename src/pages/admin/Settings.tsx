import { useEffect, useState, type ReactNode } from 'react'
import { api, useApi } from '../../api'
import { useAuth } from '../../auth'
import { ConfirmButton, ErrorText, Field, Loading, PageTitle, Progress, useAction } from '../../components/ui'
import { IconCheck, IconDownload, IconPlus, IconTrash } from '../../components/Icons'
import { download, formatBytes, sar } from '../../lib/util'
import { FREE_STORAGE_BYTES } from '../../../shared/constants'
import type { Section, Settings } from '../../../shared/types'

type S = Settings & { mailConfigured: boolean; storageConfigured: boolean; photoBytes: number; photoCount: number }

function Panel({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="card mb-4 p-4">
      <h2 className="font-bold">{title}</h2>
      {sub && <p className="mb-3 text-xs text-ink-3">{sub}</p>}
      <div className={sub ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const { can } = useAuth()
  const q = useApi<S>('/settings')
  if (!q.data) return <Loading />
  return (
    <>
      <PageTitle title="الإعدادات" />
      {can('settings.manage') && <Prizes s={q.data} reload={q.reload} />}
      {can('results.publish') && <Publish s={q.data} reload={q.reload} />}
      {can('inspections.criteria') && <Criteria s={q.data} reload={q.reload} />}
      {can('settings.manage') && <Rounds s={q.data} reload={q.reload} />}
      {can('settings.manage') && <Storage s={q.data} reload={q.reload} />}
      {(can('settings.backup') || can('settings.manage')) && <Backup s={q.data} reload={q.reload} />}
    </>
  )
}

function Saved({ show }: { show: boolean }) {
  return show ? <span className="inline-flex items-center gap-1 text-sm text-brand-700"><IconCheck width={16} /> تم الحفظ</span> : null
}

function Prizes({ s, reload }: { s: S; reload: () => void }) {
  const [f, setF] = useState({ roomPrizeCount: s.roomPrizeCount, roomPrizeAmount: s.roomPrizeAmount, wingPrizeCount: s.wingPrizeCount, wingPrizeAmount: s.wingPrizeAmount })
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAction()
  const num = (k: keyof typeof f, label: string, suffix: string) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="number" min={0} className="input" value={f[k]} onChange={(e) => (setF({ ...f, [k]: Math.max(0, Number(e.target.value) || 0) }), setSaved(false))} />
        <span className="shrink-0 text-sm text-ink-3">{suffix}</span>
      </div>
    </Field>
  )
  return (
    <Panel title="الجوائز" sub={`الإجمالي: ${sar(f.roomPrizeCount * f.roomPrizeAmount + f.wingPrizeCount * f.wingPrizeAmount)}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {num('roomPrizeCount', 'عدد الغرف الفائزة', 'غرف')}
        {num('roomPrizeAmount', 'جائزة كل غرفة', 'ريال')}
        {num('wingPrizeCount', 'عدد الأجنحة الفائزة', 'أجنحة')}
        {num('wingPrizeAmount', 'جائزة كل جناح', 'ريال')}
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={() => run(async () => (await api('/settings/prizes', { method: 'PUT', body: f }), setSaved(true), reload()))}>حفظ</button>
        <Saved show={saved} />
      </div>
    </Panel>
  )
}

function Publish({ s, reload }: { s: S; reload: () => void }) {
  const { busy, run } = useAction()
  return (
    <Panel title="إعلان النتائج للطلاب" sub="يظهر الفائزون فقط، بدون أسماء الطلاب ودرجات البقية">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`chip ${s.publicResults ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-ink-3 ring-line'}`}>{s.publicResults ? 'معلنة' : 'غير معلنة'}</span>
        <button className={s.publicResults ? 'btn-ghost' : 'btn-primary'} disabled={busy} onClick={() => run(async () => (await api('/settings/publish', { method: 'PUT', body: { publicResults: !s.publicResults } }), reload()))}>
          {s.publicResults ? 'إخفاء النتائج' : 'إعلان النتائج'}
        </button>
        <a href="/results" target="_blank" className="text-sm text-brand-700">فتح صفحة النتائج العامة</a>
      </div>
    </Panel>
  )
}

function Rounds({ s, reload }: { s: S; reload: () => void }) {
  const { run } = useAction()
  return (
    <Panel title="جولات التفتيش" sub="الجولة الجديدة تبدأ التقييم من الصفر وتحتفظ بنتائج الجولات السابقة في قاعدة البيانات. تُخفى النتائج المعلنة تلقائياً.">
      <div className="flex items-center gap-3">
        <span className="text-sm">الجولة الحالية: <b>{s.currentRound}</b></span>
        <ConfirmButton className="btn-ghost" onConfirm={() => run(async () => (await api('/settings/new-round', { body: {} }), reload()))}>بدء جولة جديدة</ConfirmButton>
      </div>
    </Panel>
  )
}

function Storage({ s, reload }: { s: S; reload: () => void }) {
  const [months, setMonths] = useState(s.photoRetentionMonths)
  const { busy, error, run } = useAction()
  const pct = (s.photoBytes / FREE_STORAGE_BYTES) * 100
  return (
    <Panel title="صور البلاغات" sub="الصور محفوظة في Cloudflare R2 (المساحة المجانية 10 جيجا) ولا يراها إلا صاحب البلاغ والموظف المختص.">
      <div className="space-y-3">
        {!s.storageConfigured && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">تخزين الصور غير مفعل، فلن يستطيع الطلاب رفع البلاغات. أضف إعدادات R2 في Vercel.</p>}
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>{s.photoCount} صورة · {formatBytes(s.photoBytes)}</span>
            <span className="text-ink-3">{pct.toFixed(1)}٪ من 10 جيجا</span>
          </div>
          <Progress value={pct} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="حذف صور البلاغات المنجزة والمرفوضة بعد" hint="الحذف يومي وتلقائي. البلاغ نفسه وسجله يبقون، والبلاغات المفتوحة لا تُحذف صورها أبداً.">
            <select className="input w-56" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              <option value={0}>لا تحذف أبداً</option>
              {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} شهر</option>)}
            </select>
          </Field>
          <button className="btn-primary" disabled={busy || months === s.photoRetentionMonths} onClick={() => run(async () => (await api('/settings/prizes', { method: 'PUT', body: { photoRetentionMonths: months } }), reload()))}>حفظ</button>
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    </Panel>
  )
}

function Backup({ s, reload }: { s: S; reload: () => void }) {
  const { can } = useAuth()
  const [email, setEmail] = useState(s.backupEmail)
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAction()
  return (
    <Panel title="النسخ الاحتياطي" sub="نسخة يومية تلقائية تُرسل بالبريد (JSON كامل + Excel للبلاغات)، ويمكنك تنزيل نسخة في أي وقت. الصور نفسها لا تدخل في النسخة لأنها محفوظة في R2.">
      <div className="space-y-3">
        {!s.mailConfigured && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">خدمة البريد غير مفعلة بعد، فلن تُرسل النسخة اليومية ولا روابط التفعيل. أضف إعدادات SMTP في Vercel.</p>}
        {can('settings.manage') && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <Field label="بريد استقبال النسخة اليومية"><input className="input" dir="ltr" type="email" value={email} onChange={(e) => (setEmail(e.target.value), setSaved(false))} /></Field>
            </div>
            <button className="btn-primary" disabled={busy} onClick={() => run(async () => (await api('/settings/prizes', { method: 'PUT', body: { backupEmail: email } }), setSaved(true), reload()))}>حفظ</button>
            <Saved show={saved} />
          </div>
        )}
        {can('settings.backup') && (
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={() => run(async () => download(`sakan-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await api('/backup')), 'application/json'))}
          >
            <IconDownload width={16} /> تنزيل نسخة احتياطية الآن
          </button>
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    </Panel>
  )
}

const uid = () => Math.random().toString(36).slice(2, 10)

function Criteria({ s, reload }: { s: S; reload: () => void }) {
  const [room, setRoom] = useState<Section[]>(s.roomTemplate)
  const [wing, setWing] = useState<Section[]>(s.wingTemplate)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const { busy, error, run } = useAction()
  useEffect(() => setSaved(false), [room, wing])

  const editor = (sections: Section[], setter: (s: Section[]) => void, allowSections: boolean) => {
    const upd = (fn: (d: Section[]) => void) => {
      const d = structuredClone(sections)
      fn(d)
      setter(d)
      setDirty(true)
    }
    return (
      <>
        {sections.map((sec, si) => (
          <div key={sec.id} className="mb-3 rounded-xl ring-1 ring-line">
            <div className="flex items-center gap-2 border-b border-line bg-canvas/60 p-2">
              <input className="input bg-white font-bold" value={sec.label} onChange={(e) => upd((d) => void (d[si].label = e.target.value))} aria-label="اسم القسم" />
              {allowSections && <button className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label="حذف القسم" onClick={() => upd((d) => void d.splice(si, 1))}><IconTrash /></button>}
            </div>
            <ul className="space-y-2 p-2">
              {sec.criteria.map((c, ci) => (
                <li key={c.id} className="flex items-center gap-2">
                  <input className="input" value={c.label} onChange={(e) => upd((d) => void (d[si].criteria[ci].label = e.target.value))} aria-label="المعيار" />
                  <select className="input w-24 shrink-0" value={c.weight} onChange={(e) => upd((d) => void (d[si].criteria[ci].weight = Number(e.target.value)))} aria-label="الوزن">
                    {[1, 2, 3].map((w) => <option key={w} value={w}>وزن ×{w}</option>)}
                  </select>
                  <button className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label="حذف المعيار" onClick={() => upd((d) => void d[si].criteria.splice(ci, 1))}><IconTrash /></button>
                </li>
              ))}
            </ul>
            <button className="m-2 mt-0 inline-flex items-center gap-1 text-sm font-medium text-brand-700" onClick={() => upd((d) => void d[si].criteria.push({ id: uid(), label: 'معيار جديد', weight: 1 }))}>
              <IconPlus width={16} /> إضافة معيار
            </button>
          </div>
        ))}
        {allowSections && (
          <button className="btn-ghost mb-2" onClick={() => upd((d) => void d.push({ id: uid(), label: 'قسم جديد', criteria: [] }))}><IconPlus width={16} /> قسم جديد</button>
        )}
      </>
    )
  }

  return (
    <Panel title="معايير التفتيش" sub={`كل معيار يُقيّم من 0 إلى ${s.maxScore}. الوزن ×2 يعني أن المعيار يُحسب ضعف غيره. إضافة معيار بعد بدء التفتيش تجعل التقييمات السابقة ناقصة حتى يُعاد تقييمها.`}>
      <h3 className="mb-2 text-sm font-bold text-ink-2">الغرفة</h3>
      {editor(room, setRoom, false)}
      <h3 className="mb-2 mt-4 text-sm font-bold text-ink-2">الجناح</h3>
      {editor(wing, setWing, true)}
      <ErrorText>{error}</ErrorText>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary" disabled={busy || !dirty} onClick={() => run(async () => (await api('/settings/criteria', { method: 'PUT', body: { roomTemplate: room, wingTemplate: wing } }), setDirty(false), setSaved(true), reload()))}>
          حفظ المعايير
        </button>
        <Saved show={saved} />
      </div>
    </Panel>
  )
}
