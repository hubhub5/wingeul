// 팩트 잠금 — 본문의 숫자·연차·인원·비율 주장이 브랜드 팩트시트에 근거가 있는지 확인.
// 브랜드에 대한 주장(저희/본원/원장/클라이언트명)이면 error, 일반 정보면 warn.

import type { Fact, Finding } from '../types'
import { splitSentences } from './text'

const CLAIM = /(\d[\d,.]*)\s*(년차|년|명|건|%|퍼센트|만원|만 원|원|천만|억|회|대|곳|배|개월|시간|분)/g
const SELF = /(저희|우리|본원|당원|원장(?!님)|대표원장|의료진|센터)/

export function factLock(text: string, facts: Fact[], brandTerms: string[] = []): Finding[] {
  const corpus = facts.map((f) => `${f.key} ${f.value}`).join(' ').replace(/[\s,]/g, '')
  const self = brandTerms.length
    ? new RegExp(`${SELF.source.slice(0, -1)}|${brandTerms.map(escapeRe).join('|')})`)
    : SELF
  const out: Finding[] = []
  const sentences = splitSentences(text)
  sentences.forEach((s, idx) => {
    for (const m of s.matchAll(CLAIM)) {
      const num = m[1].replace(/,/g, '')
      if (corpus.includes(num)) continue
      // 주어가 앞 문장에 있는 경우("저희는 …입니다. 누적 3000건 …")까지 브랜드 주장으로 본다
      // 따옴표로 시작하는 문장은 고객의 말(환자 질문)이므로 업체 주장이 아니다
      const quoted = /^[“"'‘]/.test(s.trim())
      const aboutBrand = !quoted && (self.test(s) || (idx > 0 && self.test(sentences[idx - 1]) && !/^[“"'‘]/.test(sentences[idx - 1].trim())))
      out.push({
        checker: 'factLock',
        severity: aboutBrand ? 'error' : 'warn',
        message: aboutBrand
          ? `근거 없는 브랜드 수치 "${m[0]}" — 확인된 업체 정보에 없습니다`
          : `수치 "${m[0]}" — 일반 정보라면 출처·개인차 표현을 확인하세요`,
        excerpt: s,
        suggestion: aboutBrand ? '업체 정보에 추가하거나 수치를 빼세요' : '"개인차가 있습니다" 등 단서를 붙이세요',
      })
    }
  })
  return out
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
