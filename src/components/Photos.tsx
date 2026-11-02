import { useState } from 'react'
import { IconX } from './Icons'

// Thumbnails of a request's photos; tapping one opens it full screen.
export function PhotoGallery({ ids }: { ids: { id: number }[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!ids.length) return null
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {ids.map((p) => (
          <button key={p.id} type="button" onClick={() => setOpen(p.id)} className="block aspect-square overflow-hidden rounded-xl bg-canvas ring-1 ring-line">
            <img src={`/api/maintenance/photos/${p.id}`} alt="صورة البلاغ" loading="lazy" className="size-full object-cover" />
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setOpen(null)}>
          <button className="absolute top-4 end-4 rounded-full bg-white/15 p-2 text-white" aria-label="إغلاق"><IconX /></button>
          <img src={`/api/maintenance/photos/${open}`} alt="صورة البلاغ" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </>
  )
}
