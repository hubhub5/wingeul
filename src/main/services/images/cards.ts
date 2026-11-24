// 로컬 카드 렌더러 — HTML 템플릿을 숨김 창에서 그려 PNG로 저장. API 비용 0.
// 썸네일·인포그래픽(문구형)·메시지 카드. Gemini 키가 없을 때 ai 이미지의 대체 수단이기도 하다.

import { BrowserWindow } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { StylePreset } from '@shared/types'
import { fontFaceCss } from '../../fonts'

function fonts(): string {
  return fontFaceCss()
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export interface CardTheme {
  accent: string
  soft: string
  ink: string
  paper: string
}

export function themeFrom(p: StylePreset): CardTheme {
  return { accent: p.accentColor, soft: p.highlightColor, ink: '#1d2624', paper: '#f7f4ee' }
}

/** "제목 | 항목: 설명 | 항목: 설명 | 하단" → 구조 */
export function parseVisual(visual: string): { title: string; items: { label: string; desc: string }[]; footer: string } {
  const parts = visual.split('|').map((s) => s.trim()).filter(Boolean)
  const title = parts.shift() ?? ''
  const items: { label: string; desc: string }[] = []
  let footer = ''
  parts.forEach((p, i) => {
    const m = p.match(/^([^:：]{1,24})[:：]\s*(.+)$/)
    if (m) items.push({ label: m[1].trim(), desc: m[2].trim() })
    else if (i === parts.length - 1) footer = p
    else items.push({ label: p, desc: '' })
  })
  return { title, items: items.slice(0, 4), footer }
}

const BASE = (t: CardTheme, w: number, h: number) => `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{font-family:'NanumSquareNeo',-apple-system,'Apple SD Gothic Neo',sans-serif;background:${t.paper};color:${t.ink};letter-spacing:-0.07em;word-break:keep-all;-webkit-font-smoothing:antialiased}
.grain{position:absolute;inset:0;background:radial-gradient(1200px 600px at 85% -10%, ${t.soft}cc, transparent 60%),radial-gradient(900px 500px at -10% 110%, ${t.soft}99, transparent 60%)}
`

function infographic(visual: string, caption: string, t: CardTheme, brand: string): string {
  const v = parseVisual(visual || caption)
  const items = v.items.length ? v.items : [{ label: caption, desc: '' }]
  return `<style>${fonts()}${BASE(t, 1600, 900)}
  .wrap{position:relative;height:100%;padding:96px 110px;display:flex;flex-direction:column}
  .k{font-size:22px;font-weight:700;color:${t.accent};letter-spacing:0.02em;margin-bottom:22px}
  h1{font-size:${v.title.length > 26 ? 52 : 60}px;font-weight:800;line-height:1.28;max-width:1200px}
  .grid{margin-top:auto;display:grid;grid-template-columns:repeat(${Math.min(items.length, 4)},1fr);gap:22px}
  .it{background:#ffffffd9;border-radius:28px;padding:34px 32px;min-height:190px}
  .it b{display:block;font-size:30px;font-weight:800;margin-bottom:12px}
  .it span{font-size:23px;line-height:1.5;color:#4b5552}
  .n{display:inline-flex;width:44px;height:44px;border-radius:22px;background:${t.accent};color:#fff;font-size:20px;font-weight:700;align-items:center;justify-content:center;margin-bottom:18px}
  .f{margin-top:30px;display:inline-block;align-self:flex-start;background:${t.ink};color:${t.paper};border-radius:999px;padding:14px 28px;font-size:23px;font-weight:700}
  .b{position:absolute;right:110px;top:96px;font-size:20px;color:#7d8784;font-weight:700}
  </style><div class="grain"></div><div class="wrap"><div class="k">INFORMATION</div><h1>${esc(v.title)}</h1>
  <div class="grid">${items.map((it, i) => `<div class="it"><div class="n">${i + 1}</div><b>${esc(it.label)}</b><span>${esc(it.desc)}</span></div>`).join('')}</div>
  ${v.footer ? `<div class="f">${esc(v.footer)}</div>` : ''}<div class="b">${esc(brand)}</div></div>`
}

function message(visual: string, caption: string, t: CardTheme, brand: string): string {
  const lines = (visual || caption).split(/\n|\|/).map((s) => s.trim()).filter(Boolean)
  return `<style>${fonts()}${BASE(t, 1600, 900)}
  .wrap{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  p{font-size:58px;font-weight:300;line-height:1.45}
  p b{font-weight:700}
  .line{width:2px;height:70px;background:${t.ink}33;margin:48px 0 36px}
  .br{font-size:30px;font-weight:700;color:${t.accent}}
  </style><div class="grain"></div><div class="wrap">${lines.slice(0, 3).map((l, i) => `<p>${i === lines.length - 1 && lines.length > 1 ? `<b>${esc(l)}</b>` : esc(l)}</p>`).join('')}<div class="line"></div><div class="br">${esc(brand)}</div></div>`
}

function thumbnail(visual: string, caption: string, t: CardTheme, brand: string, photo?: string): string {
  const lines = (visual || caption).split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 4)
  return `<style>${fonts()}${BASE(t, 1080, 1080)}
  body{background:linear-gradient(160deg, ${t.paper} 0%, ${t.soft} 100%)}
  .wrap{position:relative;height:100%;padding:90px 80px}
  .br{display:inline-block;font-size:28px;font-weight:700;color:${t.accent};background:#fff;border-radius:999px;padding:12px 26px}
  .t{position:relative;z-index:2;margin-top:70px}
  .t p{font-size:96px;font-weight:900;line-height:1.12;letter-spacing:-0.04em;color:${t.ink}}
  .t p:nth-child(2n){color:${t.accent}}
  .ph{position:absolute;right:-20px;bottom:0;height:78%;z-index:1}
  .ph img{height:100%;object-fit:contain;object-position:bottom right;-webkit-mask-image:linear-gradient(to left, #000 70%, transparent)}
  .bar{position:absolute;left:80px;bottom:90px;width:120px;height:8px;border-radius:4px;background:${t.accent};z-index:2}
  </style><div class="wrap"><span class="br">${esc(brand)}</span><div class="t">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
  ${photo ? `<div class="ph"><img src="${photo}"></div>` : ''}<div class="bar"></div></div>`
}

export type CardKind = 'infographic' | 'message' | 'thumbnail'

export async function renderCard(kind: CardKind, opts: { visual: string; caption: string; theme: CardTheme; brand: string; photoPath?: string }): Promise<Buffer> {
  const [w, h] = kind === 'thumbnail' ? [1080, 1080] : [1600, 900]
  let photo: string | undefined
  if (opts.photoPath && fs.existsSync(opts.photoPath)) {
    const ext = opts.photoPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
    photo = `data:image/${ext};base64,${fs.readFileSync(opts.photoPath).toString('base64')}`
  }
  const body =
    kind === 'thumbnail' ? thumbnail(opts.visual, opts.caption, opts.theme, opts.brand, photo)
    : kind === 'message' ? message(opts.visual, opts.caption, opts.theme, opts.brand)
    : infographic(opts.visual, opts.caption, opts.theme, opts.brand)
  return renderHtml(`<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`, w, h)
}

/** 임의 HTML을 정확한 픽셀 크기의 PNG로 */
export async function renderHtml(html: string, w: number, h: number, transparent = false): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false, width: w, height: h, useContentSize: true, transparent, frame: !transparent,
    backgroundColor: transparent ? '#00000000' : '#ffffff', webPreferences: { offscreen: true, sandbox: true },
  })
  try {
    win.webContents.setZoomFactor(1)
    await win.loadFile(writeTemp(html))
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => new Promise(r => setTimeout(r, 120)))')
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h })
    const size = img.getSize()
    return (size.width !== w ? img.resize({ width: w, height: h, quality: 'best' }) : img).toPNG()
  } finally {
    win.destroy()
  }
}

/** 큰 HTML(글꼴 내장)은 data: URL 길이 제한을 넘으므로 임시 파일로 연다 */
export function writeTemp(html: string): string {
  const dir = path.join(os.tmpdir(), 'wingeul')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.html`)
  fs.writeFileSync(file, html)
  setTimeout(() => fs.rmSync(file, { force: true }), 30000)
  return file
}
