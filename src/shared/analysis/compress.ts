// 경쟁글 본문을 LLM에 보내기 전에 로컬에서 압축한다. 토큰 절감의 핵심.

const NOISE = [
  /공감|댓글|이웃추가|구독|좋아요|스크랩|URL 복사|신고하기|맨 위로/,
  /^#\S+(\s+#\S+)*$/, // 해시태그 줄
  /^(사진|출처|ⓒ|©)\s*[:：]?/,
  /^[\s\-=_~·.]+$/, // 구분선
  /(카톡|카카오톡|전화|☎|tel)\s*[:：]?\s*[\d-]{7,}/i,
]

export interface CompressOptions {
  maxChars?: number // 글당 상한 (기본 1800자 ≈ 1.5k 토큰 내외)
  minLineLen?: number
}

export function compressPost(text: string, opts: CompressOptions = {}): string {
  const maxChars = opts.maxChars ?? 1800
  const minLen = opts.minLineLen ?? 6
  const seen = new Set<string>()
  const kept: string[] = []
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (line.length < minLen) continue
    if (NOISE.some((re) => re.test(line))) continue
    const key = line.replace(/\s/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(line)
  }
  // 앞부분(도입+본론)을 우선하되, 길면 앞 70% + 뒤 30%로 균형 있게 남긴다 (결론부 소구점 보존)
  const joined = kept.join('\n')
  if (joined.length <= maxChars) return joined
  const head = Math.floor(maxChars * 0.7)
  const tail = maxChars - head
  return joined.slice(0, head) + '\n…\n' + joined.slice(-tail)
}
