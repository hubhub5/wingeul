// 소비자 심리 분석 — 전부 로컬 계산 (토큰 0).
// 경쟁글의 설득 장치, 검색 의도 단계, 제목 트리거, 고객 언어, 읽기 피로도, 원고의 설득 흐름.

import type { Block } from '../types'
import { blocksToText, splitSentences, stripMarks } from './text'

// ───────── 설득 장치 (치알디니 원칙 + 헬스케어 신뢰 요인) ─────────

export const LEVERS = [
  { key: 'authority', name: '권위', desc: '전문의·경력·자격으로 신뢰를 빌려 옴', re: /(전문의|원장|대표원장|경력|학회|자격|박사|수련|임상|논문|인정의)/g },
  { key: 'social', name: '사회적 증거', desc: '다른 사람도 선택했다는 신호', re: /(많은 분|환자분들|많이 찾|사례|선택하신|오시는 분|문의가 많|자주 받는 질문)/g },
  { key: 'specific', name: '구체성', desc: '숫자·기간·단계로 막연함을 줄임', re: /\d+(\s?(개월|년|일|주|단계|가지|%|mm|분|회|번째))/g },
  { key: 'process', name: '과정 공개', desc: '무엇을 어떤 순서로 하는지 보여 줌', re: /(단계|과정|순서|먼저|다음으로|그다음|진행|절차|계획)/g },
  { key: 'risk', name: '위험 완화', desc: '실패·사후 걱정을 덜어 줌', re: /(보증|사후 ?관리|정기 ?검진|책임|재수술|관리 ?프로그램|AS|무상)/g },
  { key: 'empathy', name: '공감', desc: '독자 감정을 먼저 인정함', re: /(걱정|두려|무서|불안|부담|망설|고민|마음|이해합니다|그럴 수)/g },
  { key: 'loss', name: '손실 프레이밍', desc: '미루면 잃는 것을 보여 줌', re: /(방치|미루|악화|잃|손상|더 큰|늦어|흡수|무너)/g },
  { key: 'urgency', name: '긴급성', desc: '지금 행동할 이유', re: /(지금|빨리|서둘|조기|초기|하루라도|골든타임)/g },
  { key: 'contrast', name: '대비', desc: '선택지를 나란히 놓아 판단을 쉽게 함', re: /(비교|차이|반면|vs|VS|보다|대신|장단점)/g },
] as const

export type LeverKey = (typeof LEVERS)[number]['key']

export interface LeverAudit {
  matrix: { label: string; counts: Record<LeverKey, number> }[]
  coverage: Record<LeverKey, number> // 사용한 글 비율 0~1
  saturated: LeverKey[] // 대부분이 쓰는 장치 (차별화 안 됨)
  open: LeverKey[] // 거의 안 쓰는 장치 (공략 여지)
}

function countLevers(text: string): Record<LeverKey, number> {
  const out = {} as Record<LeverKey, number>
  for (const l of LEVERS) out[l.key] = (text.match(l.re) ?? []).length
  return out
}

export function leverAudit(posts: { label: string; text: string }[]): LeverAudit {
  const matrix = posts.map((p) => ({ label: p.label, counts: countLevers(p.text) }))
  const n = Math.max(1, matrix.length)
  const coverage = {} as Record<LeverKey, number>
  for (const l of LEVERS) coverage[l.key] = matrix.filter((m) => m.counts[l.key] > 0).length / n
  const keys = LEVERS.map((l) => l.key)
  return {
    matrix,
    coverage,
    saturated: keys.filter((k) => coverage[k] >= 0.7),
    open: keys.filter((k) => coverage[k] <= 0.3),
  }
}

// ───────── 검색 의도 단계 (구매 여정) ─────────

const STAGES = [
  { stage: '결정 직전', re: /(잘하는|추천|후기|가격|비용|견적|예약|싼|저렴|이벤트|할인|어디|곳)/ },
  { stage: '비교 검토', re: /(비교|차이|vs|종류|장단점|브랜드|국산|수입|방법|선택|기간|vs)/i },
  { stage: '지역 탐색', re: /(동|구|역|시|읍|근처|주변)$|(동|구|역)\s/ },
  { stage: '정보 탐색', re: /(이유|원인|증상|통증|부작용|과정|순서|기간|뜻|란|후|관리|주의)/ },
] as const

export function intentMix(queries: string[]): { stage: string; share: number; examples: string[] }[] {
  const buckets: Record<string, string[]> = { '결정 직전': [], '비교 검토': [], '지역 탐색': [], '정보 탐색': [], 기타: [] }
  for (const q of queries) {
    const hit = STAGES.find((s) => s.re.test(q))
    buckets[hit ? hit.stage : '기타'].push(q)
  }
  const n = Math.max(1, queries.length)
  return Object.entries(buckets)
    .map(([stage, ex]) => ({ stage, share: Math.round((ex.length / n) * 100), examples: ex.slice(0, 4) }))
    .filter((x) => x.share > 0)
    .sort((a, b) => b.share - a.share)
}

// ───────── 제목 심리 트리거 ─────────

export const TRIGGERS = [
  { name: '질문형', re: /\?|까요|나요|할까|일까/ },
  { name: '숫자형', re: /\d/ },
  { name: '손실·경고형', re: /(주의|실수|후회|위험|모르면|놓치|함정|하지 마|전에)/ },
  { name: '호기심형', re: /(진짜|이유|비밀|사실|몰랐|숨은|차이)/ },
  { name: '권위형', re: /(전문의|원장|의사|박사|전문)/ },
  { name: '가격형', re: /(가격|비용|견적|만원|저렴)/ },
  { name: '후기·경험형', re: /(후기|경험|직접|내돈내산|솔직)/ },
  { name: '대상 호명형', re: /(분들|분께|이라면|하신다면|대상|어르신|직장인)/ },
  { name: '지역형', re: /(대구|서울|부산|인천|광주|대전|울산|수원|성남|하남|미사|홍성|[가-힣]+구|[가-힣]+동|[가-힣]+역)/ },
] as const

export function titleTriggers(title: string): string[] {
  return TRIGGERS.filter((t) => t.re.test(title)).map((t) => t.name)
}

export function triggerDistribution(titles: string[]): { name: string; count: number }[] {
  return TRIGGERS.map((t) => ({ name: t.name, count: titles.filter((x) => t.re.test(x)).length })).sort((a, b) => b.count - a.count)
}

// ───────── 고객 언어 (지식iN 질문에서 자주 쓰는 말) ─────────

const STOP = new Set(['있나요', '할까요', '알려주세요', '추천', '부탁드립니다', '질문', '그리고', '혹시', '제가', '어떻게', '정도', '너무', '이번', '현재', '이거', '해야', '하는', '있는', '없는', '같은', '대구', '치과'])

export function customerWords(questions: string[], exclude: string[] = []): { word: string; count: number }[] {
  const ex = new Set([...STOP, ...exclude.flatMap((e) => e.split(/\s+/))])
  const count: Record<string, number> = {}
  for (const q of questions) {
    const seen = new Set<string>()
    for (const raw of q.split(/[\s,.?!~()]+/)) {
      const w = raw.replace(/(은|는|이|가|을|를|에|의|도|로|으로|에서|까지|요|가요|나요)$/, '')
      if (w.length < 2 || ex.has(w) || /^\d+$/.test(w) || seen.has(w)) continue
      seen.add(w)
      count[w] = (count[w] ?? 0) + 1
    }
  }
  return Object.entries(count).map(([word, c]) => ({ word, count: c })).sort((a, b) => b.count - a.count).slice(0, 18)
}

// ───────── 읽기 피로도 ─────────

export function readingLoad(text: string, images: number): { sentenceLen: number; lineLen: number; charsPerImage: number; level: '낮음' | '보통' | '높음' } {
  const sents = splitSentences(text)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const sentenceLen = Math.round(sents.reduce((a, s) => a + s.length, 0) / Math.max(1, sents.length))
  const lineLen = Math.round(lines.reduce((a, s) => a + s.length, 0) / Math.max(1, lines.length))
  const charsPerImage = Math.round(text.replace(/\s/g, '').length / Math.max(1, images))
  const score = (sentenceLen > 45 ? 1 : 0) + (lineLen > 35 ? 1 : 0) + (charsPerImage > 350 ? 1 : 0)
  return { sentenceLen, lineLen, charsPerImage, level: score >= 2 ? '높음' : score === 1 ? '보통' : '낮음' }
}

// ───────── 원고 설득 흐름 (공감 → 문제 인정 → 원인 → 해소 근거 → 확신 → 행동) ─────────

const FLOW = [
  { stage: '공감', re: /(걱정|두려|무서|부담|고민|망설|마음|이해)/ },
  { stage: '문제 제기', re: /(왜|이유|궁금|다를까|해야 할까|\?)/ },
  { stage: '원인 설명', re: /(때문|원인|달라지|구성|상태에 따라|경우)/ },
  { stage: '해소 근거', re: /(확인|진단|CT|단계|과정|방법|줄이|관리)/ },
  { stage: '확신', re: /(전문의|원장|보증|정기|책임|직접|원내)/ },
  { stage: '행동 유도', re: /(상담|문의|예약|방문|확인해 보세요|살펴보세요)/ },
] as const

export interface FlowReport {
  stages: { stage: string; at: number | null }[] // 처음 등장한 블록 순서 (0~1)
  orderScore: number // 0~100: 순서가 자연스러운가
  hook: { ok: boolean; reason: string }
  readerAddress: number // 독자를 부르는 표현 수
  questionRatio: number // 질문 문장 비율 %
  specificity: number // 1000자당 구체 수치
  dropZones: number[] // 이미지·소제목 없이 긴 구간이 시작되는 블록 번호
  coverage: { issue: string; covered: boolean }[] // 고객 고민을 원고가 다루는가
}

export function persuasionFlow(blocks: Block[], hesitationIssues: string[] = []): FlowReport {
  const texts = blocks.map((b) => (b.type === 'paragraph' || b.type === 'quote' || b.type === 'cta' || b.type === 'heading' || b.type === 'section' ? stripMarks(b.text) : b.type === 'faq' ? b.q + ' ' + b.a : b.type === 'list' ? b.items.join(' ') : ''))
  const n = Math.max(1, blocks.length - 1)
  const stages = FLOW.map((f) => {
    const i = texts.findIndex((t) => f.re.test(t))
    return { stage: f.stage, at: i === -1 ? null : Math.round((i / n) * 100) / 100 }
  })
  const present = stages.filter((s) => s.at !== null) as { stage: string; at: number }[]
  let inversions = 0
  for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) if (present[i].at > present[j].at + 0.05) inversions++
  const pairs = Math.max(1, (present.length * (present.length - 1)) / 2)
  const orderScore = Math.round((present.length / FLOW.length) * 60 + (1 - inversions / pairs) * 40)

  const first = texts.filter(Boolean).slice(0, 2).join(' ')
  const hook = /\?|까요|나요/.test(first)
    ? { ok: true, reason: '첫 부분에 질문으로 시작' }
    : /(걱정|고민|두려|부담|마음)/.test(first)
      ? { ok: true, reason: '첫 부분에 감정 공감' }
      : { ok: false, reason: '첫 3줄에 질문이나 공감 표현이 없습니다' }

  const all = blocksToText(blocks)
  const sents = splitSentences(all)
  const readerAddress = (all.match(/(여러분|분들|하시는 분|분이라면|환자분|고객님)/g) ?? []).length
  const questionRatio = Math.round((sents.filter((s) => /\?|까요|나요/.test(s)).length / Math.max(1, sents.length)) * 100)
  const specificity = Math.round(((all.match(/\d+/g) ?? []).length / Math.max(1, all.replace(/\s/g, '').length)) * 1000 * 10) / 10

  const dropZones: number[] = []
  let run = 0
  let start = -1
  blocks.forEach((b, i) => {
    if (b.type === 'image' || b.type === 'section' || b.type === 'heading' || b.type === 'table') {
      run = 0
      start = -1
      return
    }
    if (start === -1) start = i
    run += texts[i].length
    if (run > 450 && !dropZones.includes(start)) dropZones.push(start)
  })

  const coverage = hesitationIssues.map((issue) => {
    const keys = issue.split(/[\s·,/]+/).filter((w) => w.length >= 2)
    return { issue, covered: keys.some((k) => all.includes(k)) }
  })

  return { stages, orderScore, hook, readerAddress, questionRatio, specificity, dropZones, coverage }
}
