// AI 티 지수 — 휴리스틱만 사용 (토큰 0). 0(사람 같음) ~ 100(AI 같음)

import type { Finding } from '../types'
import { endingOf, splitSentences } from './text'

const CLICHES = [
  '결론적으로', '요약하자면', '다양한', '중요한 역할', '살펴보겠습니다', '알아보겠습니다', '알아보도록 하겠습니다',
  '도움이 되셨기를', '도움이 되었으면', '그렇다면', '뿐만 아니라', '한편', '또한', '따라서', '이처럼',
  '마무리하며', '시작해볼까요', '함께 알아볼까요', '핵심은', '꼭 기억하세요', '정리해 보면',
]

export interface AiTellReport {
  score: number
  findings: Finding[]
}

export function aiTell(text: string): AiTellReport {
  const sentences = splitSentences(text)
  const findings: Finding[] = []
  if (sentences.length < 5) return { score: 0, findings }

  // 1) 같은 종결어미 4연속
  let run = 1
  let maxRun = 1
  for (let i = 1; i < sentences.length; i++) {
    if (endingOf(sentences[i]) === endingOf(sentences[i - 1]) && endingOf(sentences[i]) !== '기타') {
      run++
      maxRun = Math.max(maxRun, run)
      if (run === 4) {
        findings.push({ checker: 'aiTell', severity: 'warn', message: `같은 종결어미(${endingOf(sentences[i])})가 4문장 이상 연속됩니다`, excerpt: sentences[i] })
      }
    } else run = 1
  }

  // 2) 상투적 연결어·관용구
  const clicheHits = CLICHES.map((c) => ({ c, n: text.split(c).length - 1 })).filter((x) => x.n > 0)
  const clicheTotal = clicheHits.reduce((a, x) => a + x.n, 0)
  if (clicheTotal >= 4) {
    findings.push({
      checker: 'aiTell', severity: 'warn',
      message: `AI 상투어 ${clicheTotal}회: ${clicheHits.map((x) => `${x.c}(${x.n})`).join(', ')}`,
      suggestion: '구체적인 상황·숫자·실제 경험으로 바꾸거나 삭제',
    })
  }

  // 3) 문장 길이 균일성 (사람 글은 들쭉날쭉하다)
  const lens = sentences.map((s) => s.length)
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length
  const sd = Math.sqrt(lens.reduce((a, l) => a + (l - mean) ** 2, 0) / lens.length)
  const cv = sd / Math.max(1, mean)
  if (cv < 0.3) {
    findings.push({ checker: 'aiTell', severity: 'info', message: `문장 길이가 너무 균일합니다 (변동계수 ${cv.toFixed(2)})`, suggestion: '짧은 문장을 섞어 리듬을 주세요' })
  }

  // 4) 기계적 3항 나열 "A, B, 그리고 C"
  const triads = (text.match(/[^,\n]{1,15}, [^,\n]{1,15}, 그리고 [^,\n]{1,15}/g) ?? []).length
  if (triads >= 2) findings.push({ checker: 'aiTell', severity: 'info', message: `기계적인 3항 나열 ${triads}회` })

  const score = Math.min(100, Math.round(Math.max(0, maxRun - 2) * 10 + clicheTotal * 4 + Math.max(0, 0.45 - cv) * 80 + triads * 5))
  return { score, findings }
}
