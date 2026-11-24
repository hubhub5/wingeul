import { useEffect, useState } from 'react'
import { AppProvider, useApp, type Page } from './lib/ctx'
import { usd } from './lib/api'
import Icon, { Logo } from './components/Icon'
import Dashboard from './pages/Dashboard'
import WarRoom from './pages/WarRoom'
import Clients from './pages/Clients'
import Posts from './pages/Posts'
import Editor from './pages/Editor'
import Ranks from './pages/Ranks'
import Keywords from './pages/Keywords'
import SettingsPage from './pages/Settings'

const NAV: [Page, string, string][] = [
  ['dash', '홈', 'home'],
  ['war', '원고 작성', 'quill'],
  ['keywords', '키워드', 'radar'],
  ['clients', '업체', 'people'],
  ['posts', '원고', 'doc'],
  ['ranks', '순위', 'trend'],
]

const TITLE: Record<Page, string> = {
  dash: '홈', war: '원고 작성', keywords: '키워드 발굴', clients: '업체 관리', posts: '원고 목록', editor: '원고 검수', ranks: '순위 체크', settings: '설정 · 비용',
}

function Shell() {
  const { page, go, cost, clients, clientId, setClientId, settings } = useApp()
  const [theme, setTheme] = useState<string | null>(() => {
    try { return localStorage.getItem('wg.theme') } catch { return null }
  })
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    try { if (theme) localStorage.setItem('wg.theme', theme) } catch { /* 무시 */ }
  }, [theme])
  const isDark = () => theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches)
  const ratio = cost ? Math.min(100, (cost.monthUsd / Math.max(0.01, cost.budgetUsd)) * 100) : 0

  return (
    <div className="shell">
      <aside className="rail">
        <div className="logo"><Logo size={24} /></div>
        {NAV.map(([p, label, icon]) => (
          <button key={p} className="nav-item" aria-current={page === p || (p === 'posts' && page === 'editor') ? 'page' : undefined} onClick={() => go(p)}>
            <span className="ind"><Icon name={icon} size={22} /></span>
            <span className="lb">{label}</span>
          </button>
        ))}
        <div className="sp" />
        <button className="nav-item" aria-current={page === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
          <span className="ind"><Icon name="settings" size={22} /></span>
          <span className="lb">설정</span>
        </button>
      </aside>

      <div className="content">
        <header className="appbar">
          <span className="crumb">{TITLE[page]}</span>
          {settings?.mock && <span className="mock-badge" title="WG_MOCK=1 — API를 부르지 않는 점검 모드">모의 모드</span>}
          <div className="grow" />
          <label className="select-chip" aria-label="업체 선택">
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">업체 선택</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Icon name="down" size={16} />
          </label>
          {cost && (
            <span className="budget" title="이번 달 API 사용액 / 예산">
              <b>{usd(cost.monthUsd)}</b> / {usd(cost.budgetUsd)}
              <span className="meter"><i style={{ width: `${ratio}%` }} /></span>
            </span>
          )}
          <button className="icon-btn" onClick={() => setTheme(isDark() ? 'light' : 'dark')} aria-label="밝게/어둡게 전환">
            <Icon name="moon" />
          </button>
        </header>

        <main className="app-main page">
          {settings && !settings.hasApiKey && page !== 'settings' && (
            <div className="note-box">
              <Icon name="sparkle" />
              <span>Claude API 키를 넣으면 심리 분석과 원고 작성을 쓸 수 있습니다. 수집·검수·서식 변환·카드 이미지는 키 없이도 됩니다.</span>
              <button className="btn sm pri" style={{ marginLeft: 'auto' }} onClick={() => go('settings')}>키 입력</button>
            </div>
          )}
          <div className="fade-in" key={page}>
            {page === 'dash' && <Dashboard />}
            {page === 'war' && <WarRoom />}
            {page === 'clients' && <Clients />}
            {page === 'posts' && <Posts />}
            {page === 'editor' && <Editor />}
            {page === 'ranks' && <Ranks />}
            {page === 'keywords' && <Keywords />}
            {page === 'settings' && <SettingsPage />}
          </div>
        </main>

        {(page === 'dash' || page === 'posts') && (
          <button className="fab" onClick={() => go('war')}>
            <Icon name="quill" size={22} /> 원고 작성
          </button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
