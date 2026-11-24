// 검수 레이어 통합 — 전부 로컬. 에디터에서 타이핑할 때마다 실시간으로 돌린다.

import type { Block, Fact, Finding, Industry } from '../types'
import { checkCompliance } from '../compliance/engine'
import { aiTell } from './aiTell'
import { factLock } from './factLock'
import { similarityReport, titleSimilarity, type SimilarityReport } from './similarity'
import { blocksToText, charCount, countOccurrences, stripMarks } from './text'

export interface ReviewInput {
  title: string
  blocks: Block[]
  keyword: string
  industry: Industry
  targetChars: number
  facts: Fact[]
  brandTerms: string[]
  bannedPhrases: string[]
  competitors: { label: string; text: string }[]
  pastPosts: { keyword: string; title: string; text: string }[]
}

export interface ReviewResult {
  chars: { withSpace: number; noSpace: number }
  keywordCount: number
  aiScore: number
  similarity: SimilarityReport
  findings: Finding[]
  passed: boolean // error가 하나도 없으면 통과
}

export function review(inp: ReviewInput): ReviewResult {
  const text = blocksToText(inp.blocks)
  const chars = charCount(text)
  const findings: Finding[] = []

  // 1) 글자수
  const lo = inp.targetChars * 0.9
  const hi = inp.targetChars * 1.1
  if (chars.withSpace < lo || chars.withSpace > hi) {
    findings.push({ checker: 'length', severity: 'warn', message: `글자수 ${chars.withSpace}자 (공백 포함) — 목표 ${inp.targetChars}자 ±10%를 벗어났습니다` })
  }

  // 2) 키워드 배치·밀도
  const kw = inp.keyword
  const kwCount = countOccurrences(inp.title + '\n' + text, kw)
  if (countOccurrences(inp.title, kw) === 0) findings.push({ checker: 'density', severity: 'error', message: `제목에 키워드 "${kw}"가 없습니다` })
  const firstParas = inp.blocks.filter((b) => b.type === 'paragraph').slice(0, 2).map((b) => stripMarks((b as { text: string }).text)).join(' ')
  if (countOccurrences(firstParas, kw) === 0) findings.push({ checker: 'density', severity: 'warn', message: '첫 문단(도입부)에 키워드가 없습니다' })
  const per1000 = (kwCount / Math.max(1, chars.noSpace)) * 1000
  if (kwCount < 3) findings.push({ checker: 'density', severity: 'warn', message: `키워드 반복 ${kwCount}회 — 너무 적습니다 (권장 4~8회)` })
  if (per1000 > 6) findings.push({ checker: 'density', severity: 'warn', message: `키워드 반복 ${kwCount}회 — 과다 반복은 어뷰징으로 보일 수 있습니다` })

  // 3) 업종 규제 + 금지 표현
  findings.push(...checkCompliance(inp.title, inp.blocks, inp.industry, inp.bannedPhrases))

  // 4) 팩트 잠금
  findings.push(...factLock(text, inp.facts, inp.brandTerms))

  // 5) AI 티
  const ai = aiTell(text)
  findings.push(...ai.findings)

  // 6) 유사문서 (경쟁글 + 자기 과거 글)
  const sim = similarityReport(text, [...inp.competitors, ...inp.pastPosts.map((p) => ({ label: `내 글: ${p.title}`, text: p.text }))])
  if (sim.maxScore > 0.35) findings.push({ checker: 'similarity', severity: 'error', message: `유사문서 위험 — "${sim.against[0].label}"와 ${(sim.maxScore * 100).toFixed(0)}% 겹칩니다` })
  else if (sim.maxScore > 0.2) findings.push({ checker: 'similarity', severity: 'warn', message: `"${sim.against[0].label}"와 ${(sim.maxScore * 100).toFixed(0)}% 겹칩니다` })
  for (const c of sim.copiedSentences.slice(0, 5)) findings.push({ checker: 'similarity', severity: 'warn', message: `거의 같은 문장 (${c.source})`, excerpt: c.sentence })

  // 7) 키워드 자기잠식
  const cannibal = inp.pastPosts.filter((p) => p.keyword.replace(/\s/g, '') === kw.replace(/\s/g, '') || titleSimilarity(p.title, inp.title) > 0.5)
  for (const p of cannibal) findings.push({ checker: 'cannibal', severity: 'warn', message: `같은 업체의 기존 원고 "${p.title}"과 키워드·제목이 겹칩니다 (자기잠식)` })

  const order = { error: 0, warn: 1, info: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])
  return { chars, keywordCount: kwCount, aiScore: ai.score, similarity: sim, findings, passed: !findings.some((f) => f.severity === 'error') }
}
