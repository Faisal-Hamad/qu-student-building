import writeXlsxFile from 'write-excel-file'

// Shrinks a phone photo to JPEG before upload; lowers quality until it fits the size limit.
export async function compressImage(file: File, maxSide: number, maxBytes: number): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('صيغة الصورة غير مدعومة، صوّرها بالكاميرا مباشرة'))
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.75, 0.6, 0.45, 0.3]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q))
      if (blob && blob.size <= maxBytes) return blob
    }
    throw new Error('الصورة كبيرة جداً')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const formatBytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} جيجا` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} ميجا` : `${Math.ceil(n / 1024)} كيلو`

export function download(filename: string, content: string | Blob, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Writes a right-to-left .xlsx from plain rows; each column is { title, value(row) }.
export async function exportExcel<T>(filename: string, rows: T[], columns: { title: string; value: (r: T) => string | number | null | undefined; width?: number }[]) {
  await writeXlsxFile(rows, {
    fileName: filename,
    rightToLeft: true,
    schema: columns.map((c) => ({
      column: c.title,
      type: String,
      value: (r: T) => (c.value(r) == null ? '' : String(c.value(r))),
      width: c.width ?? 18,
    })),
  })
}

const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })
export const formatDate = (iso: string | null | undefined) => (iso ? fmt.format(new Date(iso)) : '—')

const rel = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })
export function timeAgo(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [u, n] of units) if (Math.abs(s) >= n) return rel.format(Math.round(s / n), u)
  return 'الآن'
}

export const sar = (n: number) => `${n.toLocaleString('en-US')} ريال`
