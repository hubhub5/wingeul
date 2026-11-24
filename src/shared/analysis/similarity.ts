// 유사문서 위험 검사 — 문자 n-gram shingle 기반 (형태소 분석기 없이 한국어에 잘 동작)

import { splitSentences } from './text'

function shingles(text: string, n = 5): Set<string> {
  const t = text.replace(/\s+/g, '')
  const set = new Set<string>()
  for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n))
  return set
}

/** a가 b에 얼마나 포함되는가 (0~1). 내 글 기준 containment */
export function containment(a: string, b: string, n = 5): number {
  const A = shingles(a, n)
  if (A.size === 0) return 0
  const B = shingles(b, n)
  let hit = 0
  for (const s of A) if (B.has(s)) hit++
  return hit / A.size
}

export interface SimilarityReport {
  maxScore: number // 0~1
  against: { label: string; score: number }[]
  copiedSentences: { sentence: string; source: string }[] // 거의 그대로 겹치는 문장
}

export function similarityReport(mine: string, others: { label: string; text: string }[]): SimilarityReport {
  const against = others
    .map((o) => ({ label: o.label, score: Math.round(containment(mine, o.text) * 1000) / 1000 }))
    .sort((x, y) => y.score - x.score)
  const copied: { sentence: string; source: string }[] = []
  for (const s of splitSentences(mine)) {
    if (s.replace(/\s/g, '').length < 15) continue
    for (const o of others) {
      if (containment(s, o.text, 6) > 0.8) {
        copied.push({ sentence: s, source: o.label })
        break
      }
    }
  }
  return { maxScore: against[0]?.score ?? 0, against, copiedSentences: copied }
}

/** 제목 간 유사도 (2-gram Jaccard). 제목 차별도 점수에 사용 */
export function titleSimilarity(a: string, b: string): number {
  const A = shingles(a, 2)
  const B = shingles(b, 2)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const s of A) if (B.has(s)) inter++
  return inter / (A.size + B.size - inter)
}
