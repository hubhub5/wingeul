import type { Block, Finding, Industry } from '../types'
import { stripMarks } from '../analysis/text'
import { PACKS } from './packs'

function blockTexts(b: Block): string[] {
  switch (b.type) {
    case 'heading':
    case 'section':
    case 'paragraph':
    case 'quote':
    case 'cta':
      return [stripMarks(b.text)]
    case 'list':
      return b.items.map(stripMarks)
    case 'table':
      return b.rows.map((r) => r.map(stripMarks).join(' '))
    case 'faq':
      return [stripMarks(b.q), stripMarks(b.a)]
    case 'image':
      return [b.caption]
    default:
      return []
  }
}

export function checkCompliance(title: string, blocks: Block[], industry: Industry, banned: string[] = []): Finding[] {
  const pack = PACKS[industry]
  const out: Finding[] = []
  const units: { text: string; blockIndex?: number }[] = [{ text: title }]
  blocks.forEach((b, i) => blockTexts(b).forEach((t) => units.push({ text: t, blockIndex: i })))

  for (const rule of pack.rules) {
    const re = new RegExp(rule.pattern, 'gi')
    for (const u of units) {
      // 같은 문장에서 같은 규칙은 한 번만 보고
      for (const m of Array.from(u.text.matchAll(re)).slice(0, 1)) {
        out.push({
          checker: 'compliance',
          severity: rule.severity,
          message: `[${rule.label}] ${rule.message}`,
          excerpt: highlight(u.text, m.index ?? 0, m[0].length),
          suggestion: rule.suggestion,
          blockIndex: u.blockIndex,
        })
      }
    }
  }

  for (const phrase of banned.filter(Boolean)) {
    for (const u of units) {
      if (u.text.includes(phrase)) {
        out.push({ checker: 'compliance', severity: 'warn', message: `[브랜드 금지 표현] "${phrase}"`, excerpt: u.text, blockIndex: u.blockIndex })
      }
    }
  }

  const all = units.map((u) => u.text).join('\n')
  for (const req of pack.requires ?? []) {
    if (new RegExp(req.when).test(all) && !new RegExp(req.mustHave).test(all)) {
      out.push({ checker: 'compliance', severity: 'error', message: req.message })
    }
  }
  return out
}

function highlight(text: string, start: number, len: number): string {
  const from = Math.max(0, start - 20)
  const to = Math.min(text.length, start + len + 20)
  return (from > 0 ? '…' : '') + text.slice(from, start) + '【' + text.slice(start, start + len) + '】' + text.slice(start + len, to) + (to < text.length ? '…' : '')
}
