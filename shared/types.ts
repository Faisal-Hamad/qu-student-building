import type { Location, ProblemType, Status } from './constants.js'

export type TargetType = 'room' | 'wing'
export type UserKind = 'staff' | 'student'

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

export interface Settings {
  maxScore: number
  roomPrizeCount: number
  roomPrizeAmount: number
  wingPrizeCount: number
  wingPrizeAmount: number
  publicResults: boolean
  currentRound: number
  backupEmail: string
  roomTemplate: Section[]
  wingTemplate: Section[]
}

export interface Me {
  id: number
  kind: UserKind
  name: string
  email: string
  universityId: string | null
  isSuper: boolean
  roleName: string | null
  permissions: string[]
  requestsBlocked: boolean
  room: RoomRef | null
}

export interface RoomRef {
  roomId: number
  roomNumber: number
  wingId: number
  wingNumber: number
  buildingId: number
  buildingName: string
}

export interface Building {
  id: number
  name: string
  sort: number
}
export interface Wing {
  id: number
  buildingId: number
  number: number
  floor: number
}
export interface Room {
  id: number
  wingId: number
  number: number
  capacity: number
}
export interface Housing {
  buildings: Building[]
  wings: Wing[]
  rooms: Room[]
}

export interface Role {
  id: number
  nameAr: string
  nameEn: string
  kind: UserKind
  isDefault: boolean
  permissions: string[]
  userCount: number
}

export interface StudentRow {
  id: number
  name: string
  email: string
  universityId: string | null
  phone: string | null
  roomId: number | null
  roleId: number | null
  status: 'active' | 'suspended'
  requestsBlocked: boolean
  activated: boolean
  lastLoginAt: string | null
}

export interface StaffRow {
  id: number
  name: string
  email: string
  phone: string | null
  roleId: number | null
  isSuper: boolean
  status: 'active' | 'suspended'
  activated: boolean
  scopeBuildingIds: number[] | null
  lastLoginAt: string | null
}

export interface MaintenanceRequest {
  id: number
  sr: string
  studentId: number
  studentName: string
  studentUniversityId: string | null
  studentPhone: string | null
  roomId: number | null
  locationLabel: string
  location: Location
  problemType: ProblemType
  description: string
  status: Status
  assignedTo: number | null
  assignedName: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface MaintenanceEvent {
  id: number
  actorName: string | null
  action: 'created' | 'status' | 'assigned' | 'note'
  fromStatus: Status | null
  toStatus: Status | null
  note: string | null
  createdAt: string
}

export interface Inspection {
  id: number
  round: number
  targetType: TargetType
  targetId: number
  scores: Record<string, number>
  notes: string
  disqualified: boolean
  disqualifyReason: string
  inspectorId: number | null
  inspectorName: string | null
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: number
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

export interface ActivityRow {
  id: number
  actorName: string | null
  action: string
  details: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export interface PublicWinner {
  rank: number
  name: string
  location: string
  tied: boolean
}
export interface PublicResults {
  published: boolean
  roomPrizeAmount: number
  wingPrizeAmount: number
  rooms: PublicWinner[]
  wings: PublicWinner[]
}
