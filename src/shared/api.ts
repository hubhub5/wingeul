// main ↔ renderer IPC 계약. main은 이 인터페이스를 구현하고 renderer는 이것으로 호출한다.

import type { Angle, BrandBrain, Client, ClientContact, CompetitorPost, CostEntry, HesitationMap, Post, SerpSnapshot, Settings, StylePreset, TitleCandidate, Block } from './types'

export interface Bench {
  chars: number
  images: number
  headings: number
  keywordCount: number
  videoRate: number
  mapRate: number
}

export interface BattleView {
  serp: SerpSnapshot
  competitors: CompetitorPost[]
  hesitation?: HesitationMap
  bench: Bench
}

export interface CostSummary {
  monthUsd: number
  budgetUsd: number
  byStep: Record<string, number>
  byClient: Record<string, number>
  recent: CostEntry[]
  postsThisMonth: number
}

export interface SettingsInput {
  analysisModel?: string
  writingModel?: string
  monthlyBudgetUsd?: number
  targetChars?: number
  imageModel?: string
  apiKey?: string
  geminiKey?: string
}

export interface Api {
  'settings.get'(): Settings
  'settings.set'(s: SettingsInput): Settings
  'clients.list'(): Client[]
  'clients.save'(c: Client): Client
  'clients.delete'(id: string): void
  'brain.learn'(clientId: string, inp: { homepage?: string; survey?: string; sampleUrls?: string[]; sampleTexts?: string[] }): BrandBrain
  'brain.update'(clientId: string, brain: BrandBrain): Client
  'battle.get'(keyword: string): BattleView | null
  'battle.analyze'(keyword: string, force: boolean): BattleView
  'battle.hesitation'(keyword: string): HesitationMap
  'write.angles'(clientId: string, keyword: string, extra: string): Angle[]
  'write.titles'(clientId: string, keyword: string, angle: Angle): TitleCandidate[]
  'write.article'(clientId: string, keyword: string, angle: Angle, title: string): Post
  'write.rewrite'(postId: string, indexes: number[], instruction: string): Post
  'posts.list'(clientId?: string): Post[]
  'posts.save'(p: Post): Post
  'posts.delete'(id: string): void
  'posts.past'(clientId: string, exceptId?: string): { keyword: string; title: string; text: string }[]
  'rank.track'(postId: string): Post
  'rank.trackAll'(): number
  'keyword.expand'(seed: string): string[]
  'costs.summary'(): CostSummary
  'clipboard.naver'(title: string, blocks: Block[], preset: StylePreset, contact?: ClientContact): void
  'images.generate'(postId: string, index: number, engine: 'auto' | 'gemini' | 'card'): Post
  'images.generateAll'(postId: string): Post
  'images.export'(postId: string): string
  'assets.pickPhoto'(clientId: string): Client | null
  'app.info'(): { version: string; dataDir: string; mock: boolean; imageModels: Record<string, { label: string; usd: number }> }
  'clipboard.text'(text: string): void
  'shell.open'(pathOrUrl: string): void
}

export type ApiName = keyof Api
