import { describe, expect, it } from 'vitest'
import { customerWords, intentMix, leverAudit, persuasionFlow, readingLoad, titleTriggers, triggerDistribution } from '@shared/analysis/psych'
import type { Block } from '@shared/types'

describe('심리 분석 (로컬)', () => {
  it('설득 장치: 포화·공백 레버', () => {
    const a = leverAudit([
      { label: 'A', text: '전문의 원장이 3단계로 진행합니다. 걱정되시죠?' },
      { label: 'B', text: '대표원장 경력 15년. 과정을 먼저 설명드려요. 마음이 무거우시죠.' },
      { label: 'C', text: '전문의가 직접 진료합니다. 진행 순서는 이렇습니다.' },
    ])
    expect(a.saturated).toContain('authority')
    expect(a.open).toContain('risk')
  })
  it('검색 의도 단계', () => {
    const m = intentMix(['대구임플란트 가격', '대구임플란트 잘하는곳', '임플란트 통증 이유', '임플란트 종류 비교'])
    expect(m[0].stage).toBe('결정 직전')
    expect(m.map((x) => x.stage)).toContain('정보 탐색')
  })
  it('제목 트리거', () => {
    expect(titleTriggers('대구임플란트 가격 비교 전에 꼭 보세요')).toEqual(expect.arrayContaining(['손실·경고형', '가격형', '지역형']))
    expect(triggerDistribution(['왜 다를까요?', '3가지 이유'])[0].count).toBeGreaterThan(0)
  })
  it('고객 언어', () => {
    const w = customerWords(['임플란트 통증 심한가요', '임플란트 통증 오래가나요', '뼈이식 비용'], ['임플란트'])
    expect(w[0].word).toBe('통증')
  })
  it('읽기 피로도', () => {
    expect(readingLoad('짧은 줄.\n또 짧은 줄.', 4).level).toBe('낮음')
  })
  it('설득 흐름', () => {
    const blocks: Block[] = [
      { type: 'paragraph', text: '수술이 걱정되시죠?' },
      { type: 'section', num: 1, text: '왜 가격이 다를까요?' },
      { type: 'paragraph', text: '구성이 다르기 때문입니다.' },
      { type: 'paragraph', text: 'CT로 먼저 확인합니다.' },
      { type: 'paragraph', text: '전문의가 직접 집도합니다.' },
      { type: 'cta', text: '상담으로 확인해 보세요.' },
    ]
    const f = persuasionFlow(blocks, ['수술 통증', '가격 차이'])
    expect(f.hook.ok).toBe(true)
    expect(f.orderScore).toBeGreaterThan(80)
    expect(f.coverage.find((c) => c.issue === '가격 차이')?.covered).toBe(true)
  })
})
