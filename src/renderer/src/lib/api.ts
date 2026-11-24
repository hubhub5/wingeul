import type { Api, ApiName } from '@shared/api'

/** 타입 안전 IPC 호출. main에서 던진 에러 메시지를 그대로 Error로 다시 던진다 */
export async function api<K extends ApiName>(name: K, ...args: Parameters<Api[K]>): Promise<Awaited<ReturnType<Api[K]>>> {
  const r = await window.wg.call(name, args)
  if (!r.ok) throw new Error(r.error)
  return r.data as Awaited<ReturnType<Api[K]>>
}

export const usd = (n: number) => '$' + (n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2))
export const krw = (n: number) => Math.round(n * 1400).toLocaleString() + '원'
export const ymd = (ts: number) => new Date(ts).toISOString().slice(0, 10).replace(/-/g, '.')
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
/** 생성 이미지 표시용 URL (main의 wgimg 프로토콜) */
export const imgUrl = (file: string) => 'wgimg://local/' + encodeURIComponent(file)
