import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { useHousing } from '../../lib/housing'
import { BackLink, Loading, PageTitle } from '../../components/ui'
import { IconPrint } from '../../components/Icons'
import { LOCATIONS, type Location } from '../../../shared/constants'

// One QR per place in the wing. Scanning with the phone camera opens the request form with the place filled in;
// the server checks the wing matches the student's own wing.
export default function QrSheet() {
  const { wingId } = useParams()
  const housing = useHousing()
  const [codes, setCodes] = useState<Record<string, string>>({})
  const wid = Number(wingId)

  useEffect(() => {
    Promise.all(
      (Object.keys(LOCATIONS) as Location[]).map(async (loc) => [loc, await QRCode.toDataURL(`${location.origin}/student/new?wing=${wid}&loc=${loc}`, { margin: 1, width: 320 })] as const),
    ).then((pairs) => setCodes(Object.fromEntries(pairs)))
  }, [wid])

  if (!housing.labels) return <Loading />
  const w = housing.labels.wing(wid)

  return (
    <>
      <BackLink fallback="/admin/housing" label="رجوع للمباني والغرف" />
      <PageTitle title={`باركود ${w.name} — ${w.location}`} sub="اطبع الصفحة والصق كل باركود في مكانه" actions={<button className="btn-primary" onClick={() => window.print()}><IconPrint width={16} /> طباعة</button>} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(Object.keys(LOCATIONS) as Location[]).map((loc) => (
          <div key={loc} className="card break-inside-avoid p-4 text-center">
            {codes[loc] ? <img src={codes[loc]} alt="" className="mx-auto w-full max-w-48" /> : <div className="aspect-square" />}
            <div className="mt-2 font-bold">{LOCATIONS[loc]}</div>
            <div className="text-xs text-ink-3">{w.location} · {w.name}</div>
            <div className="mt-1 text-[11px] text-ink-3">امسح الباركود بكاميرا الجوال لرفع بلاغ صيانة</div>
          </div>
        ))}
      </div>
    </>
  )
}
