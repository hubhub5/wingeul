// 글의 이미지 블록 → 이미지 파일. 프롬프트는 로컬 템플릿으로 조립 (Claude 토큰 0).
// thumbnail·ai → Gemini (키가 없거나 '카드로' 선택 시 로컬 카드), card → 로컬 카드, photo → 생성하지 않음(촬영 지시).

import fs from 'fs'
import path from 'path'
import type { Block, Client, Post } from '@shared/types'
import { withPresetDefaults } from '@shared/format/naverHtml'
import { getSecret } from '../../secrets'
import { dataDir, load, save } from '../../store'
import { renderCard, themeFrom, parseVisual } from './cards'
import { generateImage, IMAGE_MODELS } from './gemini'
import { isMock } from '../llm/client'
import { BudgetExceededError, monthSpend } from '../llm/client'

type ImageBlock = Extract<Block, { type: 'image' }>
export type ImageEngine = 'auto' | 'gemini' | 'card'

const DEFAULT_STYLE = 'premium clean medical illustration, soft 3D render, warm ivory background with muted teal accents, soft studio lighting, generous whitespace, modern Korean sans-serif typography'

export function imagesDir(postId: string): string {
  const d = path.join(dataDir(), 'images', postId)
  fs.mkdirSync(d, { recursive: true })
  return d
}

/** Gemini 프롬프트 — 블록의 visual(이미지 안 문구)·shotGuide(그림 내용)와 클라이언트 스타일로 조립 */
export function buildPrompt(b: ImageBlock, client: Client, keyword: string): string {
  const style = client.assets?.imageStyle || DEFAULT_STYLE
  const rules = 'Do not add logos, watermarks, prices, before/after comparisons, patient faces, or any text other than the Korean text specified. Korean text must be spelled exactly as given and clearly legible.'
  if (b.kind === 'thumbnail') {
    const lines = (b.visual || b.caption).split('\n').map((s) => s.trim()).filter(Boolean)
    return [
      `Square 1:1 Korean blog thumbnail for "${keyword}" by ${client.name}.`,
      client.assets?.doctorPhoto ? 'Place the person from the reference photo on the right side, unchanged (same face, clothing), cleanly cut out on a soft clinic-blue gradient background.' : 'Soft clinic background with abstract medical motif, no people.',
      `Big bold Korean headline on the left, one line each, high contrast, alternating dark navy and vivid blue: ${lines.map((l) => `"${l}"`).join(' / ')}.`,
      `Small clinic name label at the top-left: "${client.name}".`,
      `Style: ${style}.`,
      rules,
    ].join('\n')
  }
  const v = parseVisual(b.visual || b.caption)
  return [
    `16:9 Korean healthcare blog infographic for the topic "${keyword}".`,
    `Main visual: ${b.shotGuide || b.caption}.`,
    `Layout: title at the top, ${v.items.length || 2} rounded label cards beside the main visual${v.footer ? ', a short pill-shaped footer note at the bottom' : ''}.`,
    'Korean text to render exactly:',
    `- Title: "${v.title}"`,
    ...v.items.map((it) => `- Card: "${it.label}"${it.desc ? ` — "${it.desc}"` : ''}`),
    v.footer ? `- Footer: "${v.footer}"` : '',
    `Style: ${style}.`,
    rules,
  ].filter(Boolean).join('\n')
}

function fileFor(postId: string, index: number, kind: string) {
  return path.join(imagesDir(postId), `${String(index + 1).padStart(2, '0')}_${kind}_${Date.now().toString(36)}.png`)
}

export async function generateBlockImage(postId: string, index: number, engine: ImageEngine = 'auto'): Promise<Post> {
  const db = load()
  const post = db.posts.find((p) => p.id === postId)
  if (!post) throw new Error('글을 찾을 수 없습니다')
  const b = post.blocks[index]
  if (!b || b.type !== 'image') throw new Error('이미지 블록이 아닙니다')
  const client = db.clients.find((c) => c.id === post.clientId)
  if (!client) throw new Error('클라이언트를 찾을 수 없습니다')
  const kind = b.kind ?? 'photo'
  if (kind === 'photo' && engine === 'auto') throw new Error('실제 촬영이 필요한 사진입니다. 종류를 AI 또는 카드로 바꾸면 생성할 수 있습니다')

  const preset = withPresetDefaults(client.preset)
  const theme = themeFrom(preset)
  const gemKey = getSecret('gemini')
  const useGemini = engine === 'gemini' || (engine === 'auto' && (kind === 'ai' || kind === 'thumbnail') && (!!gemKey || isMock()))

  let png: Buffer
  if (useGemini) {
    if (!gemKey && !isMock()) throw new Error('설정에서 Gemini API 키를 입력하세요 (또는 "카드로 생성"을 쓰면 무료)')
    if (monthSpend() >= db.settings.monthlyBudgetUsd) throw new BudgetExceededError('이번 달 예산에 도달했습니다')
    const model = db.settings.imageModel
    const refs: { mime: string; data: string }[] = []
    const photo = client.assets?.doctorPhoto
    if (kind === 'thumbnail' && photo && fs.existsSync(photo)) {
      refs.push({ mime: photo.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg', data: fs.readFileSync(photo).toString('base64') })
    }
    if (isMock()) {
      // 모의 모드: 실제 호출 없이 카드로 대신 그리고 비용 0으로 기록
      png = await renderCard(kind === 'thumbnail' ? 'thumbnail' : 'infographic', { visual: b.visual ?? '', caption: '[모의] ' + b.caption, theme, brand: client.name, photoPath: photo })
    } else {
      png = await generateImage({ apiKey: gemKey!, model, prompt: buildPrompt(b, client, post.keyword), aspect: kind === 'thumbnail' ? '1:1' : '16:9', refs })
    }
    db.costs.push({ ts: Date.now(), clientId: client.id, step: '이미지 생성', model: isMock() ? 'mock' : model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: isMock() ? 0 : IMAGE_MODELS[model]?.usd ?? 0.07 })
  } else {
    const cardKind = kind === 'thumbnail' ? 'thumbnail' : kind === 'card' ? 'message' : 'infographic'
    png = await renderCard(cardKind, { visual: b.visual ?? '', caption: b.caption, theme, brand: client.name, photoPath: client.assets?.doctorPhoto })
  }

  const file = fileFor(postId, index, useGemini ? 'ai' : 'card')
  fs.writeFileSync(file, png)
  // 이전 파일 정리
  if (b.file && b.file !== file && fs.existsSync(b.file)) fs.rmSync(b.file, { force: true })
  post.blocks[index] = { ...b, file }
  post.updatedAt = Date.now()
  save()
  return post
}

/** 생성 가능한 이미지(촬영 필요 사진 제외, 아직 파일 없는 것)를 순서대로 */
export async function generateAllImages(postId: string, progress: (m: string) => void): Promise<Post> {
  let post = load().posts.find((p) => p.id === postId)
  if (!post) throw new Error('글을 찾을 수 없습니다')
  const targets = post.blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.type === 'image' && b.kind && b.kind !== 'photo' && !b.file)
  for (const [n, { i }] of targets.entries()) {
    progress(`이미지 ${n + 1}/${targets.length} 생성 중…`)
    post = await generateBlockImage(postId, i)
  }
  return post
}

/** 네이버에 드래그해 넣기 좋게 글 순서대로 번호를 매긴 폴더로 내보내기 */
export function exportImages(postId: string): string {
  const post = load().posts.find((p) => p.id === postId)
  if (!post) throw new Error('글을 찾을 수 없습니다')
  const dir = path.join(imagesDir(postId), 'upload')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  let n = 0
  for (const b of post.blocks) {
    if (b.type !== 'image') continue
    n++
    if (b.file && fs.existsSync(b.file)) {
      const safe = (post.keyword + '_' + b.caption).replace(/[^\w가-힣]+/g, '_').slice(0, 40)
      fs.copyFileSync(b.file, path.join(dir, `${String(n).padStart(2, '0')}_${safe}.png`))
    }
  }
  return dir
}
