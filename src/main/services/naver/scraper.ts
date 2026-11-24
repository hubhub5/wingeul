// 숨겨진 Chromium 창으로 네이버 페이지를 열고 DOM을 추출한다.
// 사용자 PC의 IP와 실제 브라우저로 동작하므로 서버 수집보다 차단 위험이 낮다.
// 원칙: 사용자가 실행한 작업만 수집, 순차 처리, 요청 사이 지터, 결과는 캐시.

import { BrowserWindow, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { dataDir } from '../../store'

const UA_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

let win: BrowserWindow | null = null
let queue: Promise<unknown> = Promise.resolve()
let lastAt = 0

function getWin(): BrowserWindow {
  if (win && !win.isDestroyed()) return win
  win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 2400,
    webPreferences: { offscreen: false, sandbox: true, contextIsolation: true, javascript: true, images: false },
  })
  win.webContents.setAudioMuted(true)
  return win
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 직렬화된 큐에서 실행 — 동시 요청 1개, 요청 간 0.8~2초 지터 */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = lastAt + 800 + Math.random() * 1200 - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      return await job()
    } finally {
      lastAt = Date.now()
    }
  })
  queue = next.catch(() => undefined)
  return next
}

export interface LoadOptions {
  mobile?: boolean
  screenshot?: string // 파일명 (shots/ 아래 저장)
  settleMs?: number
  scroll?: boolean // 지연 로딩 블록(관련 검색어 등)을 띄우기 위해 끝까지 스크롤
}

/** URL을 열고 페이지 안에서 extractor 함수(문자열화)를 실행해 결과를 돌려준다 */
export function scrape<T>(url: string, extractor: string, opts: LoadOptions = {}): Promise<{ data: T; screenshotPath?: string }> {
  return enqueue(async () => {
    const w = getWin()
    w.webContents.setUserAgent(opts.mobile ? UA_MOBILE : app.userAgentFallback.replace(/Electron\/\S+\s?/, ''))
    w.setContentSize(opts.mobile ? 420 : 1280, 2400)
    await w.loadURL(url)
    await sleep(opts.settleMs ?? 600)
    if (opts.scroll) {
      await w.webContents.executeJavaScript(
        `new Promise((r) => { let y = 0; const t = setInterval(() => { y += 900; window.scrollTo(0, y); if (y > document.body.scrollHeight) { clearInterval(t); window.scrollTo(0, 0); setTimeout(r, 500) } }, 120) })`,
        true,
      )
    }
    const data = (await w.webContents.executeJavaScript(`(${extractor})()`, true)) as T
    // 셀렉터 점검용: WG_DUMP=디렉터리 이면 원본 HTML을 저장 (tests/fixtures 회귀 테스트 재료)
    if (process.env.WG_DUMP) {
      const html = (await w.webContents.executeJavaScript('document.documentElement.outerHTML')) as string
      fs.mkdirSync(process.env.WG_DUMP, { recursive: true })
      const name = url.replace(/^https?:\/\//, '').replace(/[^\w가-힣]+/g, '_').slice(0, 80) + '.html'
      fs.writeFileSync(path.join(process.env.WG_DUMP, name), html)
    }
    let screenshotPath: string | undefined
    if (opts.screenshot) {
      const img = await w.webContents.capturePage()
      const dir = path.join(dataDir(), 'shots')
      fs.mkdirSync(dir, { recursive: true })
      screenshotPath = path.join(dir, opts.screenshot)
      fs.writeFileSync(screenshotPath, img.toPNG())
    }
    return { data, screenshotPath }
  })
}

export function closeScraper() {
  if (win && !win.isDestroyed()) win.destroy()
  win = null
}
