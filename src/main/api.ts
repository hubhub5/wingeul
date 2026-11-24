import { app, clipboard, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import type { Api, BattleView, SettingsInput } from '@shared/api'
import type { Settings } from '@shared/types'
import { blocksToNaverHtml, blocksToPlain } from '@shared/format/naverHtml'
import { getSecret, setSecret } from './secrets'
import { load, save, keyOf } from './store'
import { isMock, monthSpend } from './services/llm/client'
import { exportImages, generateAllImages, generateBlockImage } from './services/images'
import { IMAGE_MODELS } from './services/images/gemini'
import { dataDir } from './store'
import { expandKeyword } from './services/naver/naver'
import * as W from './services/workflow'

type Handlers = { [K in keyof Api]: (...a: Parameters<Api[K]>) => ReturnType<Api[K]> | Promise<ReturnType<Api[K]>> }

function settingsView(): Settings {
  return { ...load().settings, hasApiKey: !!getSecret('anthropic') || isMock(), hasGeminiKey: !!getSecret('gemini'), mock: isMock() }
}

function view(keyword: string): BattleView | null {
  const b = load().battles[keyOf(keyword)]
  return b ? { ...b, bench: W.benchOf(b) } : null
}

export function makeApi(progress: W.Progress): Handlers {
  return {
    'settings.get': () => settingsView(),
    'settings.set': (s: SettingsInput) => {
      const db = load()
      const { apiKey, geminiKey, ...rest } = s
      if (apiKey !== undefined) setSecret('anthropic', apiKey.trim())
      if (geminiKey !== undefined) setSecret('gemini', geminiKey.trim())
      Object.assign(db.settings, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)))
      save()
      return settingsView()
    },

    'clients.list': () => load().clients,
    'clients.save': (c) => {
      const db = load()
      const i = db.clients.findIndex((x) => x.id === c.id)
      if (i === -1) db.clients.push(c)
      else db.clients[i] = c
      save()
      return c
    },
    'clients.delete': (id) => {
      const db = load()
      db.clients = db.clients.filter((c) => c.id !== id)
      save()
    },

    'brain.learn': (id, inp) => W.learnBrain(id, inp, progress),
    'brain.update': (id, brain) => {
      const c = load().clients.find((x) => x.id === id)
      if (!c) throw new Error('클라이언트 없음')
      c.brain = { ...brain, updatedAt: Date.now() }
      save()
      return c
    },

    'battle.get': (k) => view(k),
    'battle.analyze': async (k, force) => {
      await W.analyzeKeyword(k, force, progress)
      return view(k)!
    },
    'battle.hesitation': (k) => W.buildHesitation(k, progress),

    'write.angles': (c, k, extra) => W.makeAngles(c, k, extra),
    'write.titles': (c, k, a) => W.makeTitles(c, k, a),
    'write.article': (c, k, a, t) => W.writeArticle(c, k, a, t, progress),
    'write.rewrite': (id, idx, ins) => W.rewriteBlocks(id, idx, ins),

    'posts.list': (clientId) => load().posts.filter((p) => !clientId || p.clientId === clientId),
    'posts.save': (p) => {
      const db = load()
      const cur = db.posts.find((x) => x.id === p.id)
      p.updatedAt = Date.now()
      if (!cur) {
        db.posts.unshift(p)
        save()
        return p
      }
      // 화면의 자동 저장이 진행 중인 서버 작업(이미지 생성·순위 확인)의 결과를 덮어쓰지 않도록:
      // 순위 기록은 서버 쪽 값을 유지하고, 파일이 빠진 이미지 블록은 같은 자리의 기존 파일을 이어받는다.
      const blocks = p.blocks.map((b, i) => {
        const old = cur.blocks[i]
        if (b.type === 'image' && !b.file && old?.type === 'image' && old.file && old.caption === b.caption) return { ...b, file: old.file }
        return b
      })
      Object.assign(cur, { ...p, blocks, ranks: cur.ranks.length >= p.ranks.length ? cur.ranks : p.ranks })
      save()
      return cur
    },
    'posts.delete': (id) => {
      const db = load()
      db.posts = db.posts.filter((p) => p.id !== id)
      save()
    },
    'posts.past': (clientId, exceptId) => W.pastPostsFor(clientId, exceptId),

    'rank.track': (id) => W.trackRank(id),
    'rank.trackAll': () => W.trackAllDue(progress),

    'keyword.expand': (seed) => expandKeyword(seed),

    'costs.summary': () => {
      const db = load()
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      const month = db.costs.filter((c) => c.ts >= start)
      const byStep: Record<string, number> = {}
      const byClient: Record<string, number> = {}
      for (const c of month) {
        byStep[c.step] = (byStep[c.step] ?? 0) + c.usd
        const name = db.clients.find((x) => x.id === c.clientId)?.name ?? '공통 분석'
        byClient[name] = (byClient[name] ?? 0) + c.usd
      }
      return {
        monthUsd: monthSpend(),
        budgetUsd: db.settings.monthlyBudgetUsd,
        byStep,
        byClient,
        recent: db.costs.slice(-30).reverse(),
        postsThisMonth: db.posts.filter((p) => p.createdAt >= start).length,
      }
    },

    'clipboard.naver': (title, blocks, preset, contact) => {
      clipboard.write({ html: blocksToNaverHtml(title, blocks, preset, contact), text: blocksToPlain(blocks, contact) })
    },
    'images.generate': (postId, index, engine) => generateBlockImage(postId, index, engine),
    'images.generateAll': (postId) => generateAllImages(postId, progress),
    'images.export': (postId) => {
      const dir = exportImages(postId)
      void shell.openPath(dir)
      return dir
    },
    'assets.pickPhoto': async (clientId) => {
      const c = load().clients.find((x) => x.id === clientId)
      if (!c) throw new Error('클라이언트 없음')
      const r = await dialog.showOpenDialog({ title: '원장 사진 선택 (썸네일용)', properties: ['openFile'], filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] })
      if (r.canceled || !r.filePaths[0]) return null
      const dir = path.join(dataDir(), 'assets', c.id)
      fs.mkdirSync(dir, { recursive: true })
      const dest = path.join(dir, 'doctor' + path.extname(r.filePaths[0]).toLowerCase())
      fs.copyFileSync(r.filePaths[0], dest)
      c.assets = { ...(c.assets ?? {}), doctorPhoto: dest }
      save()
      return c
    },
    'app.info': () => ({ version: app.getVersion(), dataDir: dataDir(), mock: isMock(), imageModels: IMAGE_MODELS }),
    'clipboard.text': (text) => clipboard.writeText(text),
    'shell.open': (p) => {
      if (/^https?:\/\//.test(p)) void shell.openExternal(p)
      else void shell.openPath(p)
    },
  }
}
