import type { Block } from '../types'

/** 인라인 마크(**, ==, ^^)를 제거한 순수 텍스트 */
export function stripMarks(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/==(.+?)==/g, '$1').replace(/\^\^(.+?)\^\^/g, '$1')
}

export function charCount(s: string): { withSpace: number; noSpace: number } {
  const t = s.replace(/\r/g, '')
  return { withSpace: t.replace(/\n/g, '').length, noSpace: t.replace(/\s/g, '').length }
}

/** 블록 배열 → 본문 텍스트 (글자수·검수 계산용). 이미지/구분선은 제외 */
export function blocksToText(blocks: Block[]): string {
  const out: string[] = []
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
      case 'section':
      case 'paragraph':
      case 'quote':
      case 'cta':
        out.push(stripMarks(b.text))
        break
      case 'list':
        out.push(...b.items.map(stripMarks))
        break
      case 'table':
        out.push(...b.rows.map((r) => r.map(stripMarks).join(' ')))
        break
      case 'faq':
        out.push(stripMarks(b.q), stripMarks(b.a))
        break
    }
  }
  return out.join('\n')
}

/** 한국어 문장 분리 (마침표·물음표·느낌표·줄바꿈 기준, 이모지/물결 종결 포함) */
export function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?…~]+)(\s|$)/g, '$1\n')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}

/** 종결 어미 분류 — 문체 DNA와 AI 티 검사에서 공통 사용 */
export function endingOf(sentence: string): string {
  const s = sentence.replace(/[\s.!?…~^*=)\]"'”’\p{Extended_Pictographic}]+$/gu, '')
  const rules: [RegExp, string][] = [
    [/습니다$|ㅂ니다$|니다$/, '~니다'],
    [/(죠|지요)$/, '~죠'],
    [/(세요|시나요)$/, '~세요'],
    [/(어요|아요|에요|예요|해요|이요|여요|래요|네요|군요|게요|까요|나요|요)$/, '~요'],
    [/(다|라|자)$/, '~다'],
    [/(까|냐|니)$/, '~까'],
  ]
  for (const [re, label] of rules) if (re.test(s)) return label
  return '기타'
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  const h = haystack.replace(/\s/g, '')
  const n = needle.replace(/\s/g, '')
  if (!n) return 0
  let count = 0
  let i = h.indexOf(n)
  while (i !== -1) {
    count++
    i = h.indexOf(n, i + n.length)
  }
  return count
}
