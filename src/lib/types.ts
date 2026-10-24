export type Role = 'admin' | 'inspector'
export type TargetType = 'room' | 'wing'

export interface Criterion {
  id: string
  label: string
  weight: number
}

export interface Section {
  id: string
  label: string
  criteria: Criterion[]
}

export interface Building {
  id: string
  name: string
}

export interface Wing {
  id: string
  buildingId: string
  name: string
}

export interface Room {
  id: string
  wingId: string
  name: string
  students: string[]
}

export interface Member {
  id: string
  name: string
  role: Role
}

export interface Inspection {
  id: string
  targetType: TargetType
  targetId: string
  scores: Record<string, number>
  notes: string
  disqualified: boolean
  disqualifyReason: string
  photos: string[]
  inspectorId: string
  createdAt: string
  updatedAt: string
}

export interface Settings {
  maxScore: number
  roomPrizeCount: number
  roomPrizeAmount: number
  wingPrizeCount: number
  wingPrizeAmount: number
  publicResults: boolean
}

export interface DB {
  version: 1
  buildings: Building[]
  wings: Wing[]
  rooms: Room[]
  members: Member[]
  roomTemplate: Section[]
  wingTemplate: Section[]
  inspections: Inspection[]
  settings: Settings
}
