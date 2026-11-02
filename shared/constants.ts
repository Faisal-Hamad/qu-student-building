export const PROBLEM_TYPES = {
  furniture: 'أثاث',
  ac: 'تكييف',
  plumbing: 'سباكة',
  electric: 'كهرباء',
  other: 'أخرى',
} as const
export type ProblemType = keyof typeof PROBLEM_TYPES

export const LOCATIONS = {
  room: 'الغرفة',
  kitchen: 'المطبخ',
  lounge: 'الصالة',
  bathroom: 'دورة المياه',
  showers: 'المراوش',
} as const
export type Location = keyof typeof LOCATIONS

export const STATUSES = {
  new: 'جديد',
  in_progress: 'قيد التنفيذ',
  done: 'منجز',
  rejected: 'مرفوض',
} as const
export type Status = keyof typeof STATUSES
export const OPEN_STATUSES: Status[] = ['new', 'in_progress']

export const STATUS_TONE: Record<Status, string> = {
  new: 'bg-sky-50 text-sky-700 ring-sky-200',
  in_progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
}

// Standard building layout from the housing statistics sheet: 4 wings per floor, 3 floors;
// wing 1 has 6 rooms (the rest of its floor area is shared space), every other wing has 8.
export const STANDARD_LAYOUT = { floors: 3, wingsPerFloor: 4, firstWingRooms: 6, otherWingRooms: 8, roomCapacity: 2 }

export const MIN_PASSWORD = 8
export const DUPLICATE_WINDOW_HOURS = 24

// Photos are required on maintenance requests; the phone shrinks them before upload.
export const MIN_PHOTOS = 1
export const MAX_PHOTOS = 3
export const MAX_PHOTO_BYTES = 1_200_000
export const PHOTO_MAX_SIDE = 1280
// Cloudflare R2 free tier, used to show how full storage is.
export const FREE_STORAGE_BYTES = 10 * 1024 ** 3
