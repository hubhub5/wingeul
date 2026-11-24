import { describe, expect, it } from 'vitest'
import fs from 'fs'
import { describeFormat, guessPreset, skeleton, structureStats, type PostStructure } from '@shared/analysis/structure'

const load = (i: number) => JSON.parse(fs.readFileSync(`tests/fixtures/structure_${i}.json`, 'utf8')) as PostStructure

describe('예시 글 구조 학습', () => {
  const s1 = load(1)
  it('골격: 원장 인사 → 대표 이미지 → 환자 질문 → … → 번호 소제목 반복 → 비교표 → 체크리스트', () => {
    const sk = skeleton(s1)
    console.log(sk)
    expect(sk.startsWith('원장 인사 → 대표 이미지 → 환자 질문')).toBe(true)
    expect(sk).toMatch(/\(번호 소제목 → 이미지 → 본문.*\) ×\d/)
    expect(sk).toContain('비교표')
    expect(sk).toContain('체크리스트')
    expect(sk).toContain('지도')
  })
  it('통계: 가운데 정렬·짧은 줄', () => {
    const st = structureStats(s1)
    expect(st.centerRatio).toBeGreaterThan(0.9)
    expect(st.avgLineLen).toBeLessThan(30)
    expect(st.sections).toBeGreaterThanOrEqual(3)
  })
  it('프리셋 추정: 파스텔 형광펜·빨간 환자 질문·16px', () => {
    const p = guessPreset([load(1), load(4), load(6)])
    console.log(p)
    expect(p.align).toBe('center')
    expect(p.quoteColor).toBe('#ba0000')
    expect(p.fontSize).toBe(16)
    expect(p.highlightColor).toMatch(/^#(daf9f9|ffe3c8|c2f4db|d1f6ff)$/)
  })
  it('형식 요약', () => {
    expect(describeFormat([load(1), load(4)])).toContain('골격')
  })
})
