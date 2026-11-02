import { useMemo } from 'react'
import { useApi } from '../api'
import { unitLabels } from '../../shared/scoring'
import type { Housing } from '../../shared/types'

export function useHousing() {
  const q = useApi<Housing>('/housing')
  const labels = useMemo(() => (q.data ? unitLabels(q.data) : null), [q.data])
  const roomLabel = (roomId: number | null) => {
    if (!roomId || !labels) return '—'
    const l = labels.room(roomId)
    return `${l.location} · ${l.name}`
  }
  return { ...q, labels, roomLabel }
}
