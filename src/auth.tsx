import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Me } from '../shared/types'

interface AuthState {
  me: Me | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
  can: (...perms: string[]) => boolean
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined)

  const refresh = useCallback(async () => {
    setMe(await api<Me | null>('/auth/me').catch(() => null))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {})
    setMe(null)
  }, [])

  const can = useCallback((...perms: string[]) => Boolean(me && (me.isSuper || perms.some((p) => me.permissions.includes(p)))), [me])

  if (me === undefined) return <div className="grid min-h-dvh place-items-center text-ink-3">جارِ التحميل…</div>
  return <Ctx.Provider value={{ me, refresh, logout, can }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useAuth outside provider')
  return s
}
