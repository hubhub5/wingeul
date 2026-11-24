// Claude 호출 단일 진입점: 구조화 출력 + 프롬프트 캐싱 + 비용 기록 + 월 예산 하드 스톱.

import Anthropic from '@anthropic-ai/sdk'
import type { CostEntry } from '@shared/types'
import { getSecret } from '../../secrets'
import { load, save } from '../../store'
import { mockResponse } from './mock'

// USD per 1M tokens. [input, output, cacheWrite5m, cacheRead]
const PRICES: Record<string, [number, number, number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5, 0.125, 0.01],
  'claude-sonnet-5-5': [2, 10, 2.5, 0.1],
  'claude-opus-5-5': [4, 20, 5, 0.2],
}

export function priceOf(model: string, u: { input: number; output: number; cacheWrite: number; cacheRead: number }): number {
  const p = PRICES[model] ?? PRICES['claude-sonnet-5-5']
  return (u.input * p[0] + u.output * p[1] + u.cacheWrite * p[2] + u.cacheRead * p[3]) / 1_000_000
}

export class BudgetExceededError extends Error {}

/** 모의 모드: WG_MOCK=1 로 실행하면 API를 부르지 않고 고정 응답으로 전 과정을 점검 */
export const isMock = () => process.env.WG_MOCK === '1'
export class NoApiKeyError extends Error {}

export function monthSpend(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return load().costs.filter((c) => c.ts >= start).reduce((a, c) => a + c.usd, 0)
}

let cached: { key: string; client: Anthropic } | null = null
function client(): Anthropic {
  const key = getSecret('anthropic')
  if (!key) throw new NoApiKeyError('설정에서 Claude API 키를 먼저 입력하세요')
  if (cached?.key !== key) cached = { key, client: new Anthropic({ apiKey: key, maxRetries: 3 }) }
  return cached.client
}

export interface JsonCall {
  step: string
  model: string
  /** 고정 접두부 — 순서대로 붙고 마지막 블록에 cache_control. 같은 클라이언트·키워드면 바이트가 같아야 캐시 적중 */
  stable: string[]
  /** 매번 달라지는 요청 */
  user: string
  schema: Record<string, unknown>
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  clientId?: string
}

export async function callJson<T>(c: JsonCall): Promise<{ data: T; cost: CostEntry }> {
  const db = load()
  if (monthSpend() >= db.settings.monthlyBudgetUsd) {
    throw new BudgetExceededError(`이번 달 예산 $${db.settings.monthlyBudgetUsd}에 도달했습니다. 설정에서 상한을 올리세요`)
  }

  if (isMock()) {
    await new Promise((r) => setTimeout(r, 300))
    const cost: CostEntry = { ts: Date.now(), clientId: c.clientId, step: c.step, model: 'mock', input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 }
    db.costs.push(cost)
    save()
    return { data: mockResponse(c.step, c.user) as T, cost }
  }

  const system = c.stable.map((text, i) => ({
    type: 'text' as const,
    text,
    ...(i === c.stable.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }))
  // Sonnet/Opus 5.5는 안전 분류기 거절 시 서버 측 대체 모델로 자동 재시도
  const useFallback = /sonnet-5-5|opus-5-5/.test(c.model)

  const res = await client().beta.messages.create({
    model: c.model,
    max_tokens: c.maxTokens ?? 8000,
    system,
    messages: [{ role: 'user', content: c.user }],
    output_config: { effort: c.effort ?? 'low', format: { type: 'json_schema', schema: c.schema } },
    ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  })

  if (res.stop_reason === 'refusal') throw new Error('모델이 요청을 거절했습니다. 키워드나 입력을 바꿔 다시 시도하세요')
  if (res.stop_reason === 'max_tokens') throw new Error('응답이 길이 제한에 걸렸습니다. 다시 시도하세요')

  const u = res.usage
  const usage = {
    input: u.input_tokens,
    output: u.output_tokens,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
  }
  const cost: CostEntry = { ts: Date.now(), clientId: c.clientId, step: c.step, model: res.model, ...usage, usd: priceOf(res.model, usage) }
  db.costs.push(cost)
  save()

  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
  return { data: JSON.parse(text) as T, cost }
}
