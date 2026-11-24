// 작전실 오케스트레이션: 전장 분석 → 불안 지도 → 앵글 → 제목 → 본문 → 부분 수정, 브랜드 두뇌 학습, 순위 추적.

import type { Angle, Block, BrandBrain, Client, HesitationMap, Post, TitleCandidate } from '@shared/types'
import { benchmark, computeStyleStats } from '@shared/analysis/metrics'
import { compressPost } from '@shared/analysis/compress'
import { scoreTitle } from '@shared/analysis/titleScore'
import { blocksToText } from '@shared/analysis/text'
import { load, save, keyOf, uid, type BattleCache } from '../store'
import { callJson } from './llm/client'
import * as P from './llm/prompts'
import { checkRank, collectSerp, crawlHomepage, fetchPost, fetchStructure } from './naver/naver'
import { describeFormat, guessPreset, type PostStructure } from '@shared/analysis/structure'
import { withPresetDefaults } from '@shared/format/naverHtml'

export type Progress = (msg: string) => void

const DAY = 24 * 60 * 60 * 1000

function getClient(id: string): Client {
  const c = load().clients.find((x) => x.id === id)
  if (!c) throw new Error('클라이언트를 찾을 수 없습니다')
  return c
}

function getBattle(keyword: string): BattleCache {
  const b = load().battles[keyOf(keyword)]
  if (!b) throw new Error('먼저 상위노출 분석을 실행하세요')
  return b
}

export function benchOf(b: BattleCache) {
  return benchmark(b.competitors.map((c) => c.metrics))
}

// ───────── 1. 전장 분석 (토큰 0) ─────────

export async function analyzeKeyword(keyword: string, force: boolean, progress: Progress): Promise<BattleCache> {
  const db = load()
  const k = keyOf(keyword)
  const cached = db.battles[k]
  if (!force && cached && Date.now() - cached.serp.fetchedAt < DAY) {
    progress('24시간 안에 분석한 결과를 다시 씁니다 (비용 없음)')
    return cached
  }
  progress('통합검색·블로그탭·지식iN·자동완성 수집 중…')
  const serp = await collectSerp(keyword)
  if (!serp.blogTop.length) throw new Error('블로그 검색 결과를 읽지 못했습니다. 네트워크 상태나 네이버 화면 구조 변경을 확인하세요')
  const competitors = []
  for (const p of serp.blogTop.slice(0, 7)) {
    progress(`상위글 ${p.rank}위 읽는 중: ${p.title.slice(0, 24)}…`)
    const c = await fetchPost(p, keyword)
    if (c) competitors.push(c)
  }
  const battle: BattleCache = { serp, competitors, hesitation: undefined }
  db.battles[k] = battle
  save()
  return battle
}

// ───────── 2. 불안 지도 (Haiku 1회) ─────────

export async function buildHesitation(keyword: string, progress: Progress): Promise<HesitationMap> {
  const db = load()
  const b = getBattle(keyword)
  if (b.hesitation) return b.hesitation
  progress('상위글 소구점·고객 심리 분석 중…')
  const posts = b.competitors.map((c) => ({ rank: c.rank, title: c.title, body: compressPost(c.text, { maxChars: 1800 }) }))
  const { data } = await callJson<HesitationMap>({
    step: '고객 심리',
    model: db.settings.analysisModel,
    stable: [P.ANALYST_SYSTEM],
    user: P.hesitationUser(b.serp, posts),
    schema: P.HESITATION_SCHEMA,
    maxTokens: 6000,
    effort: 'low',
  })
  b.hesitation = data
  save()
  return data
}

// ───────── 3. 작성 단계 공통 캐시 접두부 ─────────

function writerStable(client: Client, b: BattleCache): string[] {
  if (!b.hesitation) throw new Error('먼저 고객 심리 분석을 실행하세요')
  return [P.WRITER_SYSTEM, P.brandBlock(client), P.battleBlock(b.serp, b.hesitation, b.competitors.map((c) => c.title), benchOf(b))]
}

export async function makeAngles(clientId: string, keyword: string, extra: string): Promise<Angle[]> {
  const db = load()
  const client = getClient(clientId)
  const b = getBattle(keyword)
  const { data } = await callJson<{ angles: Omit<Angle, 'id'>[] }>({
    step: '컨셉',
    model: db.settings.writingModel,
    stable: writerStable(client, b),
    user: P.anglesUser(extra),
    schema: P.ANGLES_SCHEMA,
    maxTokens: 6000,
    effort: 'medium',
    clientId,
  })
  return data.angles.map((a) => ({ ...a, id: uid() }))
}

export async function makeTitles(clientId: string, keyword: string, angle: Angle): Promise<TitleCandidate[]> {
  const db = load()
  const client = getClient(clientId)
  const b = getBattle(keyword)
  const { data } = await callJson<{ titles: TitleCandidate[] }>({
    step: '제목',
    model: db.settings.writingModel,
    stable: writerStable(client, b),
    user: P.titlesUser(angle, keyword),
    schema: P.TITLES_SCHEMA,
    maxTokens: 4000,
    effort: 'medium',
    clientId,
  })
  const comp = b.serp.blogTop.map((p) => p.title)
  const past = db.posts.filter((p) => p.clientId === clientId).map((p) => p.title)
  return data.titles
    .map((t) => ({ ...t, ...scoreTitle(t.text, keyword, comp, past) }))
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
}

type FlatBlock = {
  type: Block['type']; text: string; num: number; items: string[]; rows: string[][]; kind: string
  caption: string; shotGuide: string; visual: string; label: string; url: string; q: string; a: string
}

const KINDS = ['thumbnail', 'ai', 'card', 'photo'] as const

export function normalizeBlocks(raw: Partial<FlatBlock>[]): Block[] {
  const out: Block[] = []
  let sectionNo = 0
  for (const r of raw) {
    const text = (r.text ?? '').trim()
    switch (r.type) {
      case 'heading': case 'paragraph': case 'quote': case 'cta':
        if (text) out.push({ type: r.type, text })
        break
      case 'section':
        sectionNo++
        if (text) out.push({ type: 'section', num: r.num || sectionNo, text })
        break
      case 'list':
        if (r.items?.length) out.push({ type: 'list', items: r.items.map((i) => i.replace(/^[□■✔✓·\-]\s*/, '')) })
        break
      case 'table':
        if (r.rows?.length) out.push({ type: 'table', rows: r.rows })
        break
      case 'image': {
        const kind = (KINDS as readonly string[]).includes(r.kind ?? '') ? (r.kind as (typeof KINDS)[number]) : 'photo'
        out.push({ type: 'image', kind, caption: r.caption || text, shotGuide: r.shotGuide ?? '', visual: r.visual ?? '' })
        break
      }
      case 'divider':
        out.push({ type: 'divider' })
        break
      case 'contact':
        out.push({ type: 'contact' })
        break
      case 'link':
        if (r.url) out.push({ type: 'link', label: r.label ?? '', url: r.url })
        break
      case 'faq':
        if (r.q && r.a) out.push({ type: 'faq', q: r.q, a: r.a })
        break
    }
  }
  return out
}

function toFlat(blocks: Block[]): FlatBlock[] {
  return blocks.map((b) => ({
    type: b.type,
    text: 'text' in b ? b.text : '',
    num: b.type === 'section' ? b.num : 0,
    items: b.type === 'list' ? b.items : [],
    rows: b.type === 'table' ? b.rows : [],
    kind: b.type === 'image' ? b.kind ?? 'photo' : '',
    caption: b.type === 'image' ? b.caption : '',
    shotGuide: b.type === 'image' ? b.shotGuide : '',
    visual: b.type === 'image' ? b.visual ?? '' : '',
    label: b.type === 'link' ? b.label : '',
    url: b.type === 'link' ? b.url : '',
    q: b.type === 'faq' ? b.q : '',
    a: b.type === 'faq' ? b.a : '',
  }))
}

export async function writeArticle(clientId: string, keyword: string, angle: Angle, title: string, progress: Progress): Promise<Post> {
  const db = load()
  const client = getClient(clientId)
  const b = getBattle(keyword)
  const images = Math.min(10, Math.max(4, benchOf(b).images || 6))
  progress('원고 작성 중… 30~60초')
  const { data } = await callJson<{ blocks: FlatBlock[] }>({
    step: '원고',
    model: db.settings.writingModel,
    stable: writerStable(client, b),
    user: P.articleUser(angle, title, keyword, db.settings.targetChars, images),
    schema: P.ARTICLE_SCHEMA,
    maxTokens: 16000,
    effort: 'medium',
    clientId,
  })
  const post: Post = {
    id: uid(), clientId, keyword, title, angle, blocks: normalizeBlocks(data.blocks),
    status: 'draft', ranks: [], createdAt: Date.now(), updatedAt: Date.now(),
  }
  db.posts.unshift(post)
  save()
  return post
}

/** 선택한 블록만 부분 재작성 — 전체 재생성보다 훨씬 저렴 */
export async function rewriteBlocks(postId: string, indexes: number[], instruction: string): Promise<Post> {
  const db = load()
  const post = db.posts.find((p) => p.id === postId)
  if (!post) throw new Error('글을 찾을 수 없습니다')
  const client = getClient(post.clientId)
  const b = getBattle(post.keyword)
  const target = indexes.length ? indexes : post.blocks.map((_, i) => i)
  const subset = target.map((i) => post.blocks[i])
  const { data } = await callJson<{ blocks: FlatBlock[] }>({
    step: '부분 수정',
    model: db.settings.writingModel,
    stable: writerStable(client, b),
    user: P.rewriteUser(instruction, JSON.stringify(toFlat(subset))),
    schema: P.REWRITE_SCHEMA,
    maxTokens: 12000,
    effort: 'low',
    clientId: post.clientId,
  })
  // 이미지 블록은 생성된 파일을 이어받는다 (부분 수정이 이미지를 지우지 않게)
  const oldImages = subset.filter((b): b is Extract<Block, { type: 'image' }> => b.type === 'image')
  let imgN = 0
  const replaced = normalizeBlocks(data.blocks).map((b) => {
    if (b.type !== 'image') return b
    const old = oldImages.find((o) => o.caption === b.caption) ?? oldImages[imgN]
    imgN++
    return old?.file ? { ...b, file: old.file, kind: b.kind ?? old.kind } : b
  })
  // 연속 구간이면 그 자리에 통째로 교체, 아니면 개수가 같을 때 1:1 교체
  const sorted = [...target].sort((a, b) => a - b)
  const contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)
  if (contiguous) post.blocks.splice(sorted[0], sorted.length, ...replaced)
  else if (replaced.length === sorted.length) sorted.forEach((idx, i) => (post.blocks[idx] = replaced[i]))
  else throw new Error('떨어진 블록들을 고칠 때는 블록 수가 유지되어야 합니다. 연속된 구간을 선택하세요')
  post.updatedAt = Date.now()
  save()
  return post
}

// ───────── 브랜드 두뇌 학습 (클라이언트당 1회) ─────────

export interface BrainInput {
  homepage?: string
  survey?: string
  sampleUrls?: string[]
  sampleTexts?: string[]
}

export async function learnBrain(clientId: string, inp: BrainInput, progress: Progress): Promise<BrandBrain> {
  const db = load()
  const client = getClient(clientId)
  const parts: string[] = []
  if (inp.homepage) {
    progress('홈페이지 읽는 중…')
    parts.push(`# 홈페이지\n${compressPost(await crawlHomepage(inp.homepage), { maxChars: 12000, minLineLen: 4 })}`)
  }
  if (inp.survey?.trim()) parts.push(`# 설문지\n${inp.survey.slice(0, 12000)}`)
  const samples: string[] = [...(inp.sampleTexts ?? []).filter((t) => t.trim())]
  const structures: PostStructure[] = []
  for (const url of inp.sampleUrls ?? []) {
    if (!url.trim()) continue
    progress(`예시 글 읽는 중: ${url}`)
    const p = await fetchPost({ rank: 0, title: '', url: url.trim(), blogName: '' }, '')
    if (p) samples.push(`제목: ${p.title}\n${p.text}`)
    const st = await fetchStructure(url.trim())
    if (st) structures.push(st)
  }
  if (samples.length) parts.push(`# 기존 블로그 글\n${samples.map((s) => compressPost(s, { maxChars: 3000, minLineLen: 1 })).join('\n\n---\n\n')}`)
  if (!parts.length) throw new Error('홈페이지, 설문지, 기존 글 중 하나 이상을 넣어 주세요')

  progress('업체 정보 정리 중…')
  type Raw = Omit<BrandBrain, 'styleDna' | 'sampleExcerpt' | 'updatedAt'> & { greeting: string; closing: string; headingStyle: string; styleRules: string[] }
  const { data } = await callJson<Raw>({
    step: '업체 정보',
    model: db.settings.writingModel,
    stable: [P.BRAIN_SYSTEM],
    user: `클라이언트: ${client.name}\n\n${parts.join('\n\n')}`,
    schema: P.BRAIN_SCHEMA,
    maxTokens: 8000,
    effort: 'medium',
    clientId,
  })
  const stats = samples.length ? computeStyleStats(samples) : null
  const brain: BrandBrain = {
    summary: data.summary,
    facts: data.facts,
    strengths: data.strengths,
    tone: data.tone,
    bannedPhrases: data.bannedPhrases,
    styleDna: stats
      ? { ...stats, greeting: data.greeting, closing: data.closing, headingStyle: data.headingStyle, rules: data.styleRules, structure: describeFormat(structures) || undefined }
      : null,
    sampleExcerpt: samples[0] ? compressPost(samples[0], { maxChars: 1200, minLineLen: 1 }) : '',
    updatedAt: Date.now(),
  }
  client.brain = brain
  // 예시 글의 실제 서식(형광펜·환자 질문색·정렬·글자 크기)을 프리셋에 반영
  if (structures.length) client.preset = { ...withPresetDefaults(client.preset), ...guessPreset(structures) }
  save()
  return brain
}

// ───────── 순위 추적 ─────────

export async function trackRank(postId: string): Promise<Post> {
  const db = load()
  const post = db.posts.find((p) => p.id === postId)
  if (!post?.url) throw new Error('발행 URL을 먼저 등록하세요')
  const r = await checkRank(post.keyword, post.url)
  const date = new Date().toISOString().slice(0, 10)
  post.ranks = post.ranks.filter((x) => x.date !== date).concat({ date, ...r })
  save()
  return post
}

/** 앱 시작 시 오늘 아직 확인하지 않은 발행 글을 순차 확인 */
export async function trackAllDue(progress: Progress): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const due = load().posts.filter((p) => p.status === 'published' && p.url && !p.ranks.some((r) => r.date === today))
  for (const p of due) {
    progress(`순위 확인: ${p.title.slice(0, 20)}…`)
    try {
      await trackRank(p.id)
    } catch {
      /* 개별 실패 무시 */
    }
  }
  return due.length
}

export function pastPostsFor(clientId: string, exceptId?: string) {
  return load()
    .posts.filter((p) => p.clientId === clientId && p.id !== exceptId)
    .map((p) => ({ keyword: p.keyword, title: p.title, text: blocksToText(p.blocks) }))
}
