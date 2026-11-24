// Gemini 이미지 생성 (나노바나나 계열). 사용자 본인의 Gemini API 키 사용.
// 1순위: Interactions API (현재 문서 기준). 실패하면 구형 generateContent 형식으로 한 번 더 시도.

import { net } from 'electron'

export const IMAGE_MODELS: Record<string, { label: string; usd: number }> = {
  'gemini-nano-banana-2.1': { label: 'Nano Banana 2.1 — 가장 저렴', usd: 0.0336 },
  'gemini-3.1-flash-image': { label: 'Nano Banana 2 (3.1 Flash Image)', usd: 0.067 },
  'gemini-3-pro-image': { label: 'Nano Banana Pro — 한글 문구 정확도 최고', usd: 0.134 },
}

export interface GenInput {
  apiKey: string
  model: string
  prompt: string
  aspect: '16:9' | '1:1'
  refs?: { mime: string; data: string }[] // base64
}

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** 응답 JSON 어디에 있든 base64 이미지 데이터를 찾는다 (API 형식 변화에 견고하게) */
export function findImage(json: unknown): Buffer | null {
  let found: string | null = null
  const walk = (v: unknown, depth: number) => {
    if (found || depth > 12 || !v || typeof v !== 'object') return
    const o = v as Record<string, unknown>
    const data = o.data ?? (o as { bytesBase64Encoded?: unknown }).bytesBase64Encoded
    const mime = String(o.mime_type ?? o.mimeType ?? o.type ?? '')
    if (typeof data === 'string' && data.length > 1000 && (/image/.test(mime) || /^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 200)))) {
      found = data
      return
    }
    for (const k of Object.keys(o)) walk(o[k], depth + 1)
  }
  walk(json, 0)
  return found ? Buffer.from(found, 'base64') : null
}

async function post(url: string, key: string, body: unknown): Promise<unknown> {
  const res = await net.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

export async function generateImage(g: GenInput): Promise<Buffer> {
  const refs = g.refs ?? []
  let firstErr: unknown
  try {
    const json = await post(`${BASE}/interactions`, g.apiKey, {
      model: g.model,
      input: [{ type: 'text', text: g.prompt }, ...refs.map((r) => ({ type: 'image', mime_type: r.mime, data: r.data }))],
      response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: g.aspect, image_size: '1K' },
    })
    const img = findImage(json)
    if (img) return img
    firstErr = new Error('응답에 이미지가 없습니다')
  } catch (e) {
    firstErr = e
  }
  // 구형 형식
  try {
    const json = await post(`${BASE}/models/${g.model}:generateContent`, g.apiKey, {
      contents: [{ parts: [{ text: g.prompt }, ...refs.map((r) => ({ inline_data: { mime_type: r.mime, data: r.data } }))] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: g.aspect } },
    })
    const img = findImage(json)
    if (img) return img
  } catch {
    /* 첫 오류를 보고 */
  }
  throw firstErr instanceof Error ? firstErr : new Error(String(firstErr))
}
