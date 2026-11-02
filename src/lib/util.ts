import writeXlsxFile from 'write-excel-file'

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
