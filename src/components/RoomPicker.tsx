import type { Housing } from '../../shared/types'

// Building → wing → room cascade; value is a room id or null.
export function RoomPicker({ housing, value, onChange }: { housing: Housing; value: number | null; onChange: (roomId: number | null) => void }) {
  const room = housing.rooms.find((r) => r.id === value)
  const wing = housing.wings.find((w) => w.id === room?.wingId)
  const buildingId = wing?.buildingId

  const pickBuilding = (bid: number) => {
    const w = housing.wings.find((x) => x.buildingId === bid)
    const r = w && housing.rooms.find((x) => x.wingId === w.id)
    onChange(r?.id ?? null)
  }
  const pickWing = (wid: number) => onChange(housing.rooms.find((x) => x.wingId === wid)?.id ?? null)

  return (
    <div className="grid grid-cols-3 gap-2">
      <select className="input" value={buildingId ?? ''} onChange={(e) => (e.target.value ? pickBuilding(Number(e.target.value)) : onChange(null))} aria-label="المبنى">
        <option value="">بدون غرفة</option>
        {housing.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select className="input" value={wing?.id ?? ''} disabled={!buildingId} onChange={(e) => pickWing(Number(e.target.value))} aria-label="الجناح">
        {housing.wings.filter((w) => w.buildingId === buildingId).map((w) => <option key={w.id} value={w.id}>جناح {w.number}</option>)}
      </select>
      <select className="input" value={value ?? ''} disabled={!wing} onChange={(e) => onChange(Number(e.target.value))} aria-label="الغرفة">
        {housing.rooms.filter((r) => r.wingId === wing?.id).map((r) => <option key={r.id} value={r.id}>غرفة {r.number}</option>)}
      </select>
    </div>
  )
}
