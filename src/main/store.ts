// 로컬 JSON 저장소. 네이티브 모듈 없이 배포가 쉽도록 단순하게 구현했다.
// 데이터가 커지면 같은 인터페이스로 SQLite로 교체한다.

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { Client, CompetitorPost, CostEntry, HesitationMap, Post, SerpSnapshot, Settings } from '@shared/types'

export interface BattleCache {
  serp: SerpSnapshot
  competitors: CompetitorPost[]
  hesitation?: HesitationMap
}

interface DB {
  clients: Client[]
  posts: Post[]
  battles: Record<string, BattleCache> // key: keyword(공백 제거)
  costs: CostEntry[]
  settings: Omit<Settings, 'hasApiKey' | 'hasNaverSecret' | 'hasGeminiKey' | 'mock'>
}

const DEFAULTS: DB = {
  clients: [],
  posts: [],
  battles: {},
  costs: [],
  settings: {
    analysisModel: 'claude-haiku-5-5',
    writingModel: 'claude-sonnet-5-5',
    imageModel: 'gemini-nano-banana-2.1',
    monthlyBudgetUsd: 20,
    targetChars: 1800,
  },
}

let db: DB | null = null
let file = ''
let timer: NodeJS.Timeout | null = null

export function dataDir(): string {
  const d = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(d, { recursive: true })
  return d
}

export function load(): DB {
  if (db) return db
  file = path.join(dataDir(), 'db.json')
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    db = { ...DEFAULTS, ...raw, settings: { ...DEFAULTS.settings, ...(raw.settings ?? {}) } }
  } catch {
    db = structuredClone(DEFAULTS)
  }
  return db!
}

/** 변경 후 호출. 300ms 디바운스, 임시파일→rename으로 원자적 저장 */
export function save(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, 300)
}

export function flush(): void {
  if (!db) return
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db))
  fs.renameSync(tmp, file)
}

export const keyOf = (keyword: string) => keyword.replace(/\s/g, '').toLowerCase()
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
