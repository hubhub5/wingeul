import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/theme.css'
import App from './App'

// Material 리플: 버튼류를 누르면 누른 지점에서 퍼지는 원
const RIPPLE = '.btn, .nav-item, .tag, .pick, .block, .fab, .icon-btn, .steps button'
document.addEventListener('pointerdown', (e) => {
  const el = (e.target as HTMLElement).closest(RIPPLE) as HTMLElement | null
  if (!el || (el as HTMLButtonElement).disabled) return
  const r = el.getBoundingClientRect()
  const d = Math.max(r.width, r.height)
  const s = document.createElement('span')
  s.className = 'ripple'
  s.style.width = s.style.height = `${d}px`
  s.style.left = `${e.clientX - r.left - d / 2}px`
  s.style.top = `${e.clientY - r.top - d / 2}px`
  el.appendChild(s)
  setTimeout(() => s.remove(), 600)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
