import type { SVGProps } from 'react'

const base = (d: string) => (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={20} height={20} aria-hidden {...p}>
    <path d={d} />
  </svg>
)

export const IconHome = base('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z')
export const IconClipboard = base('M9 4h6M9 4a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2m-7 8 2 2 4-4')
export const IconTrophy = base('M8 21h8m-4-4v4m-5-17h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3')
export const IconSettings = base('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z')
export const IconLogout = base('M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11')
export const IconChevron = base('m15 18-6-6 6-6')
export const IconX = base('M18 6 6 18M6 6l12 12')
export const IconPlus = base('M12 5v14M5 12h14')
export const IconTrash = base('M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3')
export const IconAlert = base('M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z')
export const IconPrint = base('M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z')
export const IconDownload = base('M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3')
export const IconUpload = base('M12 15V3m0 0-4 4m4-4 4 4M4 17v3h16v-3')
export const IconCheck = base('m5 12 5 5 9-10')
export const IconEye = base('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z')
export const IconWrench = base('M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3.5-3.5L3 11l1.3-1.3a4 4 0 0 0 5-5L11 3zM4 20l5-5')
export const IconUsers = base('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8')
export const IconUser = base('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z')
export const IconLock = base('M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm2 0V7a4 4 0 0 1 8 0v4')
export const IconBuilding = base('M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17m0-10h4a1 1 0 0 1 1 1v9M3 21h18M8 7h3m-3 4h3m-3 4h3')
export const IconBell = base('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.9 1.9 0 0 0 3.4 0')
export const IconList = base('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01')
export const IconQr = base('M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z')
export const IconMenu = base('M4 6h16M4 12h16M4 18h16')
export const IconMail = base('M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 1 9 7 9-7')
export const IconKey = base('M15 7a3 3 0 1 1 0 .01M21 2l-9.6 9.6a5.5 5.5 0 1 0 3 3L16 13l2 2 2-2-2-2 1-1 2 2 1-1-3-3z')
