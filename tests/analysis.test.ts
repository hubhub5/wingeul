import { describe, expect, it } from 'vitest'
import { charCount, endingOf, splitSentences, countOccurrences, blocksToText } from '@shared/analysis/text'
import { compressPost } from '@shared/analysis/compress'
import { containment, similarityReport } from '@shared/analysis/similarity'
import { scoreTitle } from '@shared/analysis/titleScore'
import { factLock } from '@shared/analysis/factLock'
import { aiTell } from '@shared/analysis/aiTell'
import { computeStyleStats } from '@shared/analysis/metrics'
import { checkCompliance } from '@shared/compliance/engine'
import { review } from '@shared/analysis/review'
import { blocksToNaverHtml, DEFAULT_PRESET, inline } from '@shared/format/naverHtml'
import type { Block } from '@shared/types'

describe('text', () => {
  it('글자수 공백 포함/제외', () => {
    expect(charCount('대구 임플란트')).toEqual({ withSpace: 7, noSpace: 6 })
  })
  it('종결어미 분류', () => {
    expect(endingOf('통증이 적습니다.')).toBe('~니다')
    expect(endingOf('걱정되시죠?')).toBe('~죠')
    expect(endingOf('편하게 오세요~')).toBe('~세요')
    expect(endingOf('괜찮아요 😊')).toBe('~요')
  })
  it('문장 분리', () => {
    expect(splitSentences('안녕하세요. 오늘은 임플란트! 궁금하시죠?')).toHaveLength(3)
  })
  it('공백 무시 키워드 카운트', () => {
    expect(countOccurrences('대구 임플란트, 대구임플란트 비용', '대구임플란트')).toBe(2)
  })
})

describe('compress', () => {
  it('노이즈 제거·중복 제거·상한', () => {
    const raw = ['공감 12 댓글 3', '#대구 #임플란트', '임플란트는 뼈 상태가 중요합니다.', '임플란트는 뼈 상태가 중요합니다.', 'x'.repeat(5000)].join('\n')
    const out = compressPost(raw, { maxChars: 300 })
    expect(out).not.toContain('공감')
    expect(out).not.toContain('#대구')
    expect(out.match(/뼈 상태/g)).toHaveLength(1)
    expect(out.length).toBeLessThanOrEqual(310)
  })
})

describe('similarity', () => {
  it('동일 문장 containment 1', () => {
    expect(containment('임플란트 수술 과정을 설명드립니다', '오늘은 임플란트 수술 과정을 설명드립니다 감사합니다')).toBe(1)
  })
  it('복사 문장 탐지', () => {
    const r = similarityReport('임플란트 식립 후 3개월 정도 기다려야 뼈와 잘 붙습니다. 새로운 문장입니다 정말로요.', [
      { label: 'A', text: '보통 임플란트 식립 후 3개월 정도 기다려야 뼈와 잘 붙습니다.' },
    ])
    expect(r.copiedSentences[0]?.source).toBe('A')
  })
})

describe('titleScore', () => {
  it('키워드 앞배치 + 차별화된 제목이 더 높다', () => {
    const comp = ['대구임플란트 잘하는 곳 추천', '대구임플란트 잘하는 치과 추천 후기']
    const good = scoreTitle('대구임플란트, 뼈이식 해야 한다는 말 듣고 망설인다면', '대구임플란트', comp)
    const bad = scoreTitle('임플란트 잘하는 치과 추천 대구임플란트', '대구임플란트', comp)
    expect(good.score).toBeGreaterThan(bad.score)
  })
})

describe('factLock', () => {
  const facts = [{ key: '경력', value: '대표원장 임상 15년', source: '홈페이지', verified: true }]
  it('브랜드 수치가 팩트시트에 있으면 통과', () => {
    expect(factLock('저희 대표원장은 15년 동안 진료했습니다.', facts)).toHaveLength(0)
  })
  it('없는 브랜드 수치는 error', () => {
    const f = factLock('저희 치과는 누적 3000건 이상 시술했습니다.', facts)
    expect(f[0].severity).toBe('error')
  })
  it('앞 문장의 주어까지 보고 브랜드 주장으로 판단', () => {
    const f = factLock('저희 치과는 수성구에 있습니다. 누적 3000건 이상 시술했습니다.', facts)
    expect(f[0].severity).toBe('error')
  })
  it('환자 질문 속 "원장님"은 업체 주장이 아니다', () => {
    const f = factLock('예시치과 대표원장입니다.\n“원장님, 임플란트가 80만원인 곳도 있던데요?”', facts)
    expect(f[0].severity).toBe('warn')
  })
  it('일반 정보 수치는 warn', () => {
    const f = factLock('보통 치유 기간은 3개월 정도 걸립니다.', facts)
    expect(f[0].severity).toBe('warn')
  })
})

describe('compliance (의료)', () => {
  const blocks: Block[] = [
    { type: 'paragraph', text: '저희는 대구 최고의 임플란트 치과입니다.' },
    { type: 'paragraph', text: '지금 예약하시면 30% 할인 이벤트!' },
    { type: 'paragraph', text: '환자분 후기를 보면 만족하셨다고 합니다.' },
  ]
  it('최상급·할인·치료경험담·부작용 미고지 모두 잡는다', () => {
    const f = checkCompliance('대구임플란트', blocks, 'medical')
    const ids = f.map((x) => x.message).join('|')
    expect(ids).toContain('최상급')
    expect(ids).toContain('할인')
    expect(ids).toContain('치료경험담')
    expect(ids).toContain('부작용')
    expect(f.filter((x) => x.message.includes('할인')).length).toBe(1)
  })
  it('정상 문장은 통과', () => {
    const ok: Block[] = [{ type: 'paragraph', text: '임플란트는 잇몸뼈 상태에 따라 과정이 달라집니다. 개인차가 있을 수 있습니다.' }]
    expect(checkCompliance('대구임플란트 과정', ok, 'medical')).toHaveLength(0)
  })
})

describe('aiTell', () => {
  it('상투어·같은 종결이 많으면 점수가 높다', () => {
    const robotic = Array.from({ length: 8 }, (_, i) => `또한 ${i + 1}번째 다양한 요소가 중요한 역할을 합니다.`).join(' ') + ' 결론적으로 살펴보겠습니다. 요약하자면 그렇습니다.'
    const human = '아프냐고요? 솔직히 조금은요. 근데 생각보다 금방 끝나요. 마취하고 나면 누르는 느낌 정도? 대부분 그날 저녁엔 죽 드시고 주무십니다. 걱정되시면 미리 말씀 주세요.'
    expect(aiTell(robotic).score).toBeGreaterThan(aiTell(human).score)
  })
})

describe('styleStats', () => {
  it('종결 비율 계산', () => {
    const s = computeStyleStats(['안녕하세요. 오늘은 날씨가 좋아요. 임플란트 이야기 해볼게요.'])
    expect(s.endingRatios['~요']).toBeGreaterThan(0.5)
  })
})

describe('naverHtml', () => {
  it('인라인 마크 변환과 정렬', () => {
    const h = inline('**굵게** ==형광== ^^강조^^ <x>', DEFAULT_PRESET)
    expect(h).toContain('<b>굵게</b>')
    expect(h).toContain(`background-color:${DEFAULT_PRESET.highlightColor}`)
    expect(h).toContain('&lt;x&gt;')
    const html = blocksToNaverHtml('t', [{ type: 'heading', text: '소제목' }, { type: 'paragraph', text: '첫 문장. 둘째 문장.' }])
    expect(html).toContain('text-align:center')
    expect(html.match(/<p /g)!.length).toBeGreaterThanOrEqual(3)
  })
})

describe('review 통합', () => {
  it('키워드 없는 제목은 error, 통과 실패', () => {
    const blocks: Block[] = [{ type: 'paragraph', text: '대구임플란트 이야기입니다.' }]
    const r = review({
      title: '임플란트 이야기', blocks, keyword: '대구임플란트', industry: 'general', targetChars: 1800,
      facts: [], brandTerms: [], bannedPhrases: [], competitors: [], pastPosts: [],
    })
    expect(r.passed).toBe(false)
    expect(blocksToText(blocks)).toContain('대구임플란트')
  })
})
