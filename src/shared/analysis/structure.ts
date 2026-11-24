// 예시 글의 스마트에디터 컴포넌트 순서 → 글 골격 + 서식 프리셋 추정. 전부 로컬 (토큰 0).

import type { StylePreset } from '../types'

export interface Comp {
  type: string // text | image | imageStrip | table | quotation | oglink | placesMap | ...
  layout?: string
  align?: string
  text?: string
  marks?: string[]
  lines?: number
  images?: string[]
  fontSize?: string
}

export interface PostStructure {
  title: string
  components: Comp[]
}

const ZW = /[​\s]/g
const hasText = (c: Comp) => (c.text ?? '').replace(ZW, '').length > 0

function token(c: Comp, i: number, all: Comp[]): string | null {
  const t = (c.text ?? '').replace(/​/g, '')
  switch (c.type) {
    case 'text': {
      if (!hasText(c)) return null
      // 환자 질문을 먼저 본다 ("원장님, …" 질문이 인사말로 오인되지 않게)
      if (/^[“"]/.test(t.trim())) return '환자 질문 → 결론 먼저'
      if (i < 3 && /(원장|대표)[^.]{0,20}입니다/.test(t)) return '원장 인사'
      if (/□|✔|체크리스트/.test(t)) return '체크리스트'
      return '본문'
    }
    case 'table':
      if (/^\s*\d+\s*\.+/.test(t)) return '번호 소제목'
      if (/전화|문의|예약/.test(t) && t.length < 120) return '전화문의 박스'
      return '비교표'
    case 'image':
    case 'imageStrip':
    case 'imageGroup':
      return all.slice(0, i).some((x) => /image/.test(x.type)) ? '이미지' : '대표 이미지'
    case 'quotation':
      return '인용구'
    case 'oglink':
      return '링크 카드'
    case 'placesMap':
      return '지도'
    case 'video':
    case 'oembed':
      return '동영상'
    case 'horizontalLine':
      return null
    default:
      return null
  }
}

/** 글 골격 문자열. 반복되는 [번호 소제목 → 이미지 → 본문] 묶음은 ×N 으로 접는다 */
export function skeleton(s: PostStructure): string {
  const toks: string[] = []
  s.components.forEach((c, i) => {
    const t = token(c, i, s.components)
    if (t && toks[toks.length - 1] !== t) toks.push(t)
  })
  // 반복 묶음 접기: 번호 소제목으로 시작하는 구간
  const out: string[] = []
  let i = 0
  while (i < toks.length) {
    if (toks[i] === '번호 소제목') {
      let j = i
      let n = 0
      const unit: string[] = []
      while (j < toks.length && toks[j] === '번호 소제목') {
        n++
        let k = j + 1
        const seg: string[] = ['번호 소제목']
        while (k < toks.length && toks[k] !== '번호 소제목' && ['이미지', '본문', '인용구'].includes(toks[k])) seg.push(toks[k++])
        if (!unit.length) unit.push(...seg)
        j = k
      }
      out.push(`(${unit.join(' → ')}) ×${n}`)
      i = j
    } else out.push(toks[i++])
  }
  return out.join(' → ')
}

export interface StructureStats {
  images: number
  sections: number
  tables: number
  links: number
  hasMap: boolean
  centerRatio: number
  avgLineLen: number // 한 줄 평균 글자수 (짧은 줄바꿈 스타일 판별)
}

export function structureStats(s: PostStructure): StructureStats {
  const c = s.components
  const texts = c.filter((x) => x.type === 'text' && hasText(x))
  const lines = texts.flatMap((x) => (x.text ?? '').split('\n').map((l) => l.replace(ZW, '')).filter(Boolean))
  return {
    images: c.reduce((a, x) => a + (x.images?.length ?? 0), 0),
    sections: c.filter((x) => x.type === 'table' && /^\s*\d+\s*\./.test(x.text ?? '')).length,
    tables: c.filter((x) => x.type === 'table').length,
    links: c.filter((x) => x.type === 'oglink').length,
    hasMap: c.some((x) => x.type === 'placesMap'),
    centerRatio: texts.length ? texts.filter((x) => x.align === 'center').length / texts.length : 0,
    avgLineLen: lines.length ? Math.round(lines.reduce((a, l) => a + l.length, 0) / lines.length) : 0,
  }
}

function topColor(marks: string[], prefix: 'HL' | 'C', exclude: RegExp): string | undefined {
  const count: Record<string, number> = {}
  for (const m of marks) {
    const mm = m.match(new RegExp(`^${prefix}\\[(#[0-9a-fA-F]{6})\\](.*)$`))
    if (!mm || exclude.test(mm[1]) || !mm[2].replace(ZW, '')) continue
    count[mm[1].toLowerCase()] = (count[mm[1].toLowerCase()] ?? 0) + 1
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0]
}

function topColorAny(marks: string[], exclude: RegExp): string | undefined {
  const count: Record<string, number> = {}
  for (const m of marks) {
    const mm = m.match(/^C\[(#[0-9a-fA-F]{6})\]/)
    if (!mm || exclude.test(mm[1])) continue
    count[mm[1].toLowerCase()] = (count[mm[1].toLowerCase()] ?? 0) + 1
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0]
}

/** 여러 예시 글에서 서식 프리셋 추정 (형광펜·환자 질문색·정렬·글자 크기) */
export function guessPreset(samples: PostStructure[]): Partial<StylePreset> {
  const marks = samples.flatMap((s) => s.components.flatMap((c) => c.marks ?? []))
  const hl = topColor(marks, 'HL', /^#f{6}$/i)
  // 환자 질문색: 따옴표로 시작하는 색 지정 문장이 있으면 그 색, 없으면 문서에 지정된 색(빈 칸 포함) 중 최빈값
  const quoted = marks.map((m) => m.match(/^C\[(#[0-9a-fA-F]{6})\]\s*[“"]/)).find(Boolean)
  const color = quoted?.[1].toLowerCase() ?? topColorAny(marks, /^#(000000|333333|ffffff)$/i)
  const stats = samples.map(structureStats)
  const center = stats.reduce((a, s) => a + s.centerRatio, 0) / Math.max(1, stats.length)
  const fs = samples.flatMap((s) => s.components.map((c) => c.fontSize ?? '')).join(',').match(/fs(\d+)/g) ?? []
  const fsCount: Record<string, number> = {}
  fs.forEach((f) => (fsCount[f] = (fsCount[f] ?? 0) + 1))
  const topFs = Object.entries(fsCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  const out: Partial<StylePreset> = { align: center >= 0.5 ? 'center' : 'left' }
  if (hl) out.highlightColor = hl
  if (color) {
    out.quoteColor = color
    out.quoteStyle = 'patient'
  }
  if (topFs) out.fontSize = Math.min(20, Math.max(13, +topFs.slice(2)))
  return out
}

/** 브랜드 두뇌·작성 프롬프트에 넣을 형식 요약 */
export function describeFormat(samples: PostStructure[]): string {
  if (!samples.length) return ''
  const st = samples.map(structureStats)
  const avg = (f: (s: StructureStats) => number) => Math.round(st.reduce((a, s) => a + f(s), 0) / st.length)
  return [
    `골격: ${skeleton(samples[0])}`,
    `평균 이미지 ${avg((s) => s.images)}장, 번호 소제목 ${avg((s) => s.sections)}개, 표 ${avg((s) => s.tables)}개, 링크 카드 ${avg((s) => s.links)}개${st.some((s) => s.hasMap) ? ', 끝에 지도' : ''}`,
    `한 줄 평균 ${avg((s) => s.avgLineLen)}자 — 짧게 줄바꿈하고 2~3줄마다 빈 줄`,
  ].join('\n')
}
