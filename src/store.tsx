import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { get, set } from 'idb-keyval'
import type { DB, Member } from './lib/types'
import { demoDB } from './lib/seed'

const DB_KEY = 'sakan-db-v1'
const USER_KEY = 'sakan-user'

interface Store {
  db: DB
  user: Member | null
  update: (fn: (draft: DB) => void) => void
  replace: (db: DB) => void
  login: (id: string) => void
  logout: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB | null>(null)
  const [userId, setUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(USER_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    get<DB>(DB_KEY)
      .then((saved) => setDb(saved ?? demoDB()))
      .catch(() => setDb(demoDB()))
  }, [])

  useEffect(() => {
    if (db) set(DB_KEY, db).catch(() => {})
  }, [db])

  const update = useCallback((fn: (draft: DB) => void) => {
    setDb((prev) => {
      if (!prev) return prev
      const draft = structuredClone(prev)
      fn(draft)
      return draft
    })
  }, [])

  const login = useCallback((id: string) => {
    setUserId(id)
    try {
      localStorage.setItem(USER_KEY, id)
    } catch {}
  }, [])

  const logout = useCallback(() => {
    setUserId(null)
    try {
      localStorage.removeItem(USER_KEY)
    } catch {}
  }, [])

  if (!db) {
    return <div className="grid min-h-dvh place-items-center text-ink-3">جارِ التحميل…</div>
  }

  const user = db.members.find((m) => m.id === userId) ?? null
  return <Ctx.Provider value={{ db, user, update, replace: setDb, login, logout }}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}
