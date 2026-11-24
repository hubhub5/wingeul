import type { PostMetrics, StyleStats } from '../types'
import { charCount, countOccurrences, endingOf, splitSentences } from './text'

export interface ParsedPost {
  title: string
  paragraphs: string[] // 본문 문단 (DOM 순서)
  headings: string[]
  images: number
  hasVideo: boolean
  hasMap: boolean
}

export function computeMetrics(p: ParsedPost, keyword: string): PostMetrics {
  const body = p.paragraphs.join('\n')
  const c = charCount(body)
  const firstPara = p.paragraphs.slice(0, 3).join(' ')
  return {
    chars: c.withSpace,
    charsNoSpace: c.noSpace,
    images: p.images,
    headings: p.headings.length,
    keywordCount: countOccurrences(p.title + '\n' + body, keyword),
    keywordInTitle: countOccurrences(p.title, keyword) > 0,
    keywordInFirstPara: countOccurrences(firstPara, keyword) > 0,
    hasVideo: p.hasVideo,
    hasMap: p.hasMap,
  }
}

const EMOJI = /\p{Extended_Pictographic}/gu

/** 사용자의 기존 글에서 문체 통계를 로컬로 계산 (토큰 0) */
export function computeStyleStats(texts: string[]): StyleStats {
  const sentences = texts.flatMap(splitSentences)
  const total = Math.max(1, sentences.length)
  const endings: Record<string, number> = {}
  for (const s of sentences) {
    const e = endingOf(s)
    endings[e] = (endings[e] ?? 0) + 1
  }
  for (const k of Object.keys(endings)) endings[k] = Math.round((endings[k] / total) * 100) / 100
  const allText = texts.join('\n')
  const chars = Math.max(1, allText.replace(/\s/g, '').length)
  const paragraphs = texts.flatMap((t) => t.split(/\n{2,}/)).filter((p) => p.trim())
  return {
    avgSentenceLen: Math.round(sentences.reduce((a, s) => a + s.length, 0) / total),
    endingRatios: endings,
    emojiPer1000: Math.round(((allText.match(EMOJI)?.length ?? 0) / chars) * 1000 * 10) / 10,
    avgParagraphSentences: Math.round((sentences.length / Math.max(1, paragraphs.length)) * 10) / 10,
  }
}

/** 경쟁글 상위 N개의 평균 지표 — "이기려면 최소 이 정도" 기준선 */
export function benchmark(list: PostMetrics[]) {
  const n = Math.max(1, list.length)
  const avg = (f: (m: PostMetrics) => number) => Math.round(list.reduce((a, m) => a + f(m), 0) / n)
  return {
    chars: avg((m) => m.chars),
    images: avg((m) => m.images),
    headings: avg((m) => m.headings),
    keywordCount: avg((m) => m.keywordCount),
    videoRate: Math.round((list.filter((m) => m.hasVideo).length / n) * 100),
    mapRate: Math.round((list.filter((m) => m.hasMap).length / n) * 100),
  }
}
