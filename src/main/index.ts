import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import { dataDir, flush } from './store'
import { makeApi } from './api'
import { closeScraper } from './services/naver/scraper'
import { splashHtml } from './brand'
import { writeTemp } from './services/images/cards'
import { e2eDir, runDevMode, runE2E } from './dev'

// 테스트·데모용 데이터 폴더 분리: WG_DATA=/경로
if (process.env.WG_DATA) app.setPath('userData', process.env.WG_DATA)

let main: BrowserWindow | null = null

// 생성한 이미지를 화면에 보여 주는 전용 프로토콜 (데이터 폴더 안 파일만 허용)
protocol.registerSchemesAsPrivileged([{ scheme: 'wgimg', privileges: { standard: true, secure: true, supportFetchAPI: true } }])

function progress(msg: string) {
  main?.webContents.send('progress', msg)
}

function createSplash(): BrowserWindow {
  const s = new BrowserWindow({
    width: 720, height: 440, frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: true, show: false, skipTaskbar: true, hasShadow: true, backgroundColor: '#00000000',
  })
  void s.loadFile(writeTemp(splashHtml(app.getVersion())))
  s.once('ready-to-show', () => s.show())
  return s
}

function createWindow(withSplash: boolean) {
  const splash = withSplash ? createSplash() : null
  const shownAt = Date.now()
  main = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: 'WinGeul',
    show: false,
    backgroundColor: '#f4f2ed',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 34, y: 20 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  })
  main.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  main.once('ready-to-show', () => {
    // 스플래시를 최소 1.6초 보여 준 뒤 부드럽게 전환
    const delay = splash ? Math.max(0, 1600 - (Date.now() - shownAt)) : 0
    setTimeout(() => {
      main?.show()
      if (splash && !splash.isDestroyed()) {
        let o = 1
        const t = setInterval(() => {
          o -= 0.1
          if (o <= 0 || splash.isDestroyed()) {
            clearInterval(t)
            if (!splash.isDestroyed()) splash.destroy()
          } else splash.setOpacity(o)
        }, 16)
      }
    }, delay)
  })
  if (process.env.ELECTRON_RENDERER_URL) void main.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void main.loadFile(path.join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  if (await runDevMode()) return

  protocol.handle('wgimg', (req) => {
    const p = decodeURIComponent(new URL(req.url).pathname.slice(1))
    if (!path.resolve(p).startsWith(dataDir())) return new Response('forbidden', { status: 403 })
    return net.fetch(pathToFileURL(p).toString())
  })
  const api = makeApi(progress)
  ipcMain.handle('api', async (_e, name: string, args: unknown[]) => {
    const fn = (api as Record<string, (...a: unknown[]) => unknown>)[name]
    if (!fn) throw new Error(`알 수 없는 API: ${name}`)
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      // Error 객체는 IPC로 메시지가 잘 전달되지 않으므로 직접 직렬화
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  const e2e = e2eDir()
  createWindow(!e2e)
  if (e2e && main) main.webContents.once('did-finish-load', () => void runE2E(main!, e2e))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(false)
  })
})

app.on('window-all-closed', () => {
  closeScraper()
  flush()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => flush())
