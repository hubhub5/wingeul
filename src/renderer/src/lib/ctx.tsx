import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Client, Post, Settings } from '@shared/types'
import type { CostSummary } from '@shared/api'
import { api } from './api'

export type Page = 'dash' | 'war' | 'clients' | 'posts' | 'editor' | 'ranks' | 'keywords' | 'settings'

interface Ctx {
  page: Page
  go: (p: Page) => void
  clients: Client[]
  reloadClients: () => Promise<void>
  clientId: string
  setClientId: (id: string) => void
  settings: Settings | null
  reloadSettings: () => Promise<void>
  cost: CostSummary | null
  reloadCost: () => Promise<void>
  keyword: string
  setKeyword: (k: string) => void
  openPost: (p: Post) => void
  editing: Post | null
  setEditing: (p: Post | null) => void
  /** 비동기 작업 실행: 진행 표시 + 에러 표시 + 비용 갱신 */
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | undefined>
  busy: boolean
}

const C = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(C)

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('dash')
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientIdState] = useState<string>(() => safeGet('clientId') ?? '')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [cost, setCost] = useState<CostSummary | null>(null)
  const [keyword, setKeyword] = useState('')
  const [editing, setEditing] = useState<Post | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err?: boolean; label?: string } | null>(null)

  const reloadClients = useCallback(async () => setClients(await api('clients.list')), [])
  const reloadSettings = useCallback(async () => setSettings(await api('settings.get')), [])
  const reloadCost = useCallback(async () => setCost(await api('costs.summary')), [])

  useEffect(() => {
    void reloadClients()
    void reloadSettings()
    void reloadCost()
    return window.wg.onProgress((text) => setMsg((m) => ({ text, label: m?.label })))
  }, [reloadClients, reloadSettings, reloadCost])

  const setClientId = (id: string) => {
    setClientIdState(id)
    safeSet('clientId', id)
  }

  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T>) => {
      setBusy(true)
      setMsg({ text: '시작…', label })
      try {
        const r = await fn()
        setMsg(null)
        return r
      } catch (e) {
        setMsg({ text: e instanceof Error ? e.message : String(e), err: true, label })
        return undefined
      } finally {
        setBusy(false)
        void reloadCost()
      }
    },
    [reloadCost],
  )

  const openPost = (p: Post) => {
    setEditing(p)
    setPage('editor')
  }

  return (
    <C.Provider value={{ page, go: setPage, clients, reloadClients, clientId, setClientId, settings, reloadSettings, cost, reloadCost, keyword, setKeyword, openPost, editing, setEditing, run, busy }}>
      {children}
      {msg && (
        <div className={'progress' + (msg.err ? ' err' : '')} onClick={() => msg.err && setMsg(null)} role="status">
          <span className="mono">{msg.err ? '오류 · 클릭해서 닫기' : msg.label}</span>
          {msg.text}
          {!msg.err && <div className="busy-line" />}
        </div>
      )}
    </C.Provider>
  )
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem('wg.' + k)
  } catch {
    return null
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem('wg.' + k, v)
  } catch {
    /* 무시 */
  }
}
