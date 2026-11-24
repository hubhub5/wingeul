// 제목 점수 — 전부 로컬 계산. 가중치는 플레이북(순위 학습)으로 조정 가능.

import { titleSimilarity } from './similarity'

export interface TitleWeights {
  keywordFront: number
  length: number
  specificity: number
  curiosity: number
  differentiation: number
  freshness: number
}

export const DEFAULT_TITLE_WEIGHTS: TitleWeights = {
  keywordFront: 20,
  length: 15,
  specificity: 15,
  curiosity: 15,
  differentiation: 25,
  freshness: 10,
}

const CURIOSITY = /(\?|왜|진짜|몰랐|실수|후회|함정|차이|비밀|이유|전에|꼭|놓치|솔직|현실|속지|모르면|vs|VS)/
const SPECIFIC = /(\d|[0-9]+가지|체크리스트|총정리|비용|가격|기간|순서|단계|비교)/

export function scoreTitle(
  title: string,
  keyword: string,
  competitorTitles: string[],
  pastTitles: string[] = [],
  w: TitleWeights = DEFAULT_TITLE_WEIGHTS,
): { score: number; breakdown: Record<string, number> } {
  const t = title.trim()
  const kw = keyword.replace(/\s/g, '')
  const compact = t.replace(/\s/g, '')
  const idx = compact.indexOf(kw)
  const keywordFront = idx === -1 ? 0 : idx === 0 ? 1 : idx <= 6 ? 0.7 : 0.4

  const len = t.length
  const length = len >= 18 && len <= 32 ? 1 : len >= 14 && len <= 40 ? 0.6 : 0.2

  const specificity = SPECIFIC.test(t) ? 1 : 0.3
  const curiosity = CURIOSITY.test(t) ? 1 : 0.3

  const maxSim = Math.max(0, ...competitorTitles.map((c) => titleSimilarity(t, c)))
  const differentiation = Math.max(0, 1 - maxSim * 1.6)

  const maxPast = Math.max(0, ...pastTitles.map((c) => titleSimilarity(t, c)))
  const freshness = Math.max(0, 1 - maxPast * 1.6)

  const parts = { keywordFront, length, specificity, curiosity, differentiation, freshness }
  const breakdown: Record<string, number> = {}
  let score = 0
  for (const k of Object.keys(parts) as (keyof TitleWeights)[]) {
    breakdown[k] = Math.round(parts[k] * w[k])
    score += parts[k] * w[k]
  }
  return { score: Math.round(score), breakdown }
}
