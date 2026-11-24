// 개발자 점검 모드 (배포 사용자에게는 보이지 않음)
//   --spike=키워드      네이버 수집 결과 JSON
//   --post=URL          예시 글 구조(컴포넌트 순서) JSON
//   --render-brand=DIR  스플래시·아이콘 PNG 렌더링
//   --e2e=DIR           모의 모드에서 실제 화면을 클릭하며 전 기능 점검 + 화면 캡처 + 결과 리포트

import { app, BrowserWindow, clipboard } from 'electron'
import fs from 'fs'
import path from 'path'
import { closeScraper, scrape } from './services/naver/scraper'
import { collectSerp, fetchPost, mobileUrl } from './services/naver/naver'
import { EXTRACT_STRUCTURE } from './services/naver/extractors'
import { renderHtml } from './services/images/cards'
import { iconHtml, splashHtml } from './brand'

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)

/** 점검 모드면 실행하고 true (앱 정상 실행 안 함) */
export async function runDevMode(): Promise<boolean> {
  const spike = arg('spike')
  const post = arg('post')
  const brand = arg('render-brand')
  if (!spike && !post && !brand) return false
  try {
    if (spike) {
      const serp = await collectSerp(spike)
      const posts = []
      for (const p of serp.blogTop.slice(0, 3)) posts.push(await fetchPost(p, spike))
      out({ serp, posts: posts.map((p) => p && { rank: p.rank, title: p.title, metrics: p.metrics, head: p.text.slice(0, 200) }) })
    }
    if (post) {
      const r = await scrape(mobileUrl(post), EXTRACT_STRUCTURE, { mobile: true, settleMs: 1200, scroll: true })
      out(r.data)
    }
    if (brand) {
      fs.mkdirSync(brand, { recursive: true })
      fs.writeFileSync(path.join(brand, 'splash.png'), await renderHtml(splashHtml(app.getVersion(), true), 720, 440, true))
      fs.writeFileSync(path.join(brand, 'icon.png'), await renderHtml(iconHtml(), 1024, 1024, true))
      out({ ok: true, dir: brand })
    }
  } catch (e) {
    process.stdout.write('DEV ERROR ' + String(e) + '\n')
  }
  closeScraper()
  app.exit(0)
  return true
}

function out(v: unknown) {
  process.stdout.write(JSON.stringify(v, null, 1) + '\n')
}

// ───────── E2E ─────────

export function e2eDir(): string | undefined {
  return arg('e2e')
}

/** 메인 창에서 실제 UI를 조작하며 전 과정을 점검한다. 결과는 DIR/report.json + 단계별 PNG */
export async function runE2E(win: BrowserWindow, dir: string) {
  // 어떤 단계에서 멈춰도 15분 후 강제 종료
  setTimeout(() => { process.stdout.write('[e2e] 전체 시간 초과\n'); app.exit(2) }, 15 * 60 * 1000)
  try {
    await e2eBody(win, dir)
  } catch (e) {
    process.stdout.write('[e2e] FAIL 중단: ' + String(e) + '\n')
    try {
      fs.writeFileSync(path.join(dir, 'FAIL.png'), (await win.webContents.capturePage()).toPNG())
      process.stdout.write('[e2e] 화면 텍스트: ' + String(await win.webContents.executeJavaScript('document.body.innerText.slice(0, 600)')).replace(/\n/g, ' | ') + '\n')
    } catch { /* 무시 */ }
    app.exit(1)
  }
}

async function e2eBody(win: BrowserWindow, dir: string) {
  fs.mkdirSync(dir, { recursive: true })
  const log: { step: string; ok: boolean; note?: string }[] = []
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const js = <T = unknown>(code: string) =>
    (win.webContents.executeJavaScript(code, true) as Promise<T>).catch((e) => {
      throw new Error(`${String(e).slice(0, 80)} ← ${code.slice(0, 140)}`)
    })
  const shot = async (name: string) => fs.writeFileSync(path.join(dir, `${String(log.length).padStart(2, '0')}_${name}.png`), (await win.webContents.capturePage()).toPNG())
  const check = async (step: string, fn: () => Promise<boolean | string>) => {
    try {
      const r = await fn()
      log.push({ step, ok: r === true || (typeof r === 'string' && !r.startsWith('FAIL')), note: typeof r === 'string' ? r : undefined })
    } catch (e) {
      log.push({ step, ok: false, note: String(e) })
    }
    process.stdout.write(`[e2e] ${log.at(-1)!.ok ? 'OK  ' : 'FAIL'} ${step}${log.at(-1)!.note ? ' — ' + log.at(-1)!.note : ''}\n`)
  }
  // 페이지 안 헬퍼
  await js(`
    window.__t = {
      q: (s) => document.querySelector(s),
      byText: (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t)),
      click: (sel, t) => { const e = t ? window.__t.byText(sel, t) : document.querySelector(sel); if (!e) throw new Error('없음: ' + sel + ' ' + (t||'')); e.click(); return true },
      set: (el, v) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); return true },
      text: () => document.body.innerText,
    }; true`)
  const until = async (cond: string, ms = 90000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await js<boolean>(`!!(${cond})`)) return true
      await wait(400)
    }
    throw new Error('시간 초과: ' + cond)
  }
  const nav = (label: string) => js(`[...document.querySelectorAll('.nav-item')].find(e => e.querySelector('.lb').textContent.trim() === ${JSON.stringify(label)}).click()`).then(() => wait(500))
  const idle = () => until(`!document.querySelector('.progress:not(.err)')`, 180000)

  await wait(1200)
  await check('홈 화면 · 나눔스퀘어 네오 · 자간 -0.07em', async () => {
    const r = await js<string>(`document.fonts.check('700 16px NanumSquareNeo') + ' ' + getComputedStyle(document.body).letterSpacing + ' ' + getComputedStyle(document.body).fontSize`)
    return r.startsWith('true') ? r : 'FAIL ' + r
  })
  await shot('home')

  // 1. 설정
  await nav('설정')
  await check('설정: 모의 모드 표시', async () => (await js<boolean>(`__t.text().includes('모의 모드')`)) || 'FAIL')
  await shot('settings')

  // 2. 클라이언트 생성 + 연락처 + 두뇌 학습 (예시 글 구조는 실제 네이버에서 읽음)
  await nav('업체')
  await js(`__t.click('.block.add')`)
  await until(`__t.byText('h2', '기본 정보')`)
  await js(`__t.set(document.querySelector('label.f input[type=text]'), '예시치과')`)
  await wait(300)
  await js(`__t.set(document.querySelector('input[type=tel]'), '0507-0000-0000')`)
  await wait(300)
  await js(`__t.set([...document.querySelectorAll('textarea')].find(t => t.placeholder.includes('blog.naver.com')) || [...document.querySelectorAll('label.f')].find(l => l.textContent.includes('예시 글 주소')).querySelector('textarea'), ${JSON.stringify(process.env.WG_E2E_SAMPLE ?? '')})`)
  await js(`__t.set([...document.querySelectorAll('label.f')].find(l => l.textContent.includes('설문지')).querySelector('textarea'), '대구 북구 침산동 365일 진료 치과. 통합치의학과 전문의.')`)
  await js(`__t.click('button', '분석 시작')`)
  await wait(800)
  await idle()
  await check('업체 정보 분석 + 예시 글 형식 학습', async () => {
    const t = await js<string>(`__t.text()`)
    // 예시 글 주소(WG_E2E_SAMPLE)를 준 경우에만 형식 분석 섹션까지 확인
    const needFormat = !!process.env.WG_E2E_SAMPLE
    return t.includes('확인된 정보') && (!needFormat || t.includes('형식')) ? true : 'FAIL ' + t.slice(0, 200)
  })
  await check('예시 글에서 서식 프리셋 자동 추출 (환자 질문색)', async () => {
    const c = await js<string[]>(`[...document.querySelectorAll('input[type=color]')].map(i => i.value)`)
    return c.join(',')
  })
  await shot('client')

  // 3. 작전실 — 실제 네이버 수집 + 모의 LLM
  await nav('원고 작성')
  await until(`document.querySelector('input[placeholder*="대구임플란트"]')`)
  await js(`__t.set(document.querySelector('input[placeholder*="대구임플란트"]'), '대구임플란트')`)
  await js(`__t.click('#go-analyze')`)
  await until(`__t.byText('h2', '블로그탭 상위 10')`, 240000)
  await check('상위노출 분석: 블로그탭 상위글 수집', async () => {
    const n = await js<number>(`document.querySelectorAll('.tbl tbody tr').length`)
    return n >= 5 ? `${n}개` : 'FAIL ' + n
  })
  await shot('battlefield')
  await js(`__t.click('#go-psych2')`)
  await wait(500)
  await js(`document.querySelector('#go-psych') && document.querySelector('#go-psych').click()`)
  await until(`__t.byText('h2', '고객 고민')`)
  await check('고객 심리: 고민 지도', async () => ((await js<number>(`document.querySelectorAll('.matrix tbody tr').length`)) > 0) || 'FAIL')
  await shot('psych_map')
  for (const tab of ['페르소나', '감정·심리 기제', '설득 장치', '검색 의도', '고객 언어', '반론 처리']) {
    await js(`[...document.querySelectorAll('.tabs button')].find(b => b.textContent.startsWith(${JSON.stringify(tab)})).click()`)
    await wait(400)
    await check('고객 심리: ' + tab, async () => ((await js<number>(`document.querySelector('.sec').innerText.length`)) > 30) || 'FAIL 비어 있음')
    await shot('psych_' + tab.replace(/[^가-힣]/g, ''))
  }
  await js(`__t.click('#go-concept')`)
  await wait(400)
  await js(`__t.click('#go-angles')`)
  await until(`document.querySelectorAll('.pick').length >= 3`)
  await check('컨셉 3개', async () => true)
  await shot('angles')
  await js(`document.querySelector('.pick').click()`)
  await until(`__t.byText('h2', '제목 후보')`)
  await check('제목 후보 + 로컬 점수', async () => (await js<string>(`document.querySelector('.score')?.textContent || ''`)) || 'FAIL')
  await shot('titles')
  await js(`__t.click('#go-write')`)
  await until(`document.querySelector('.doc .blk')`)
  await idle()
  await check('원고 생성 → 원고 검수 (새 블록: 번호 소제목·비교표·전화문의)', async () => {
    const types = await js<string[]>(`[...document.querySelectorAll('.blk')].map(b => [...b.classList].find(c => c.startsWith('t-')))`)
    const need = ['t-section', 't-table', 't-contact', 't-image', 't-quote']
    const miss = need.filter((n) => !types.includes(n))
    return miss.length ? 'FAIL 없음: ' + miss.join(',') : `${types.length}블록`
  })
  await shot('editor')

  // 4. 이미지 생성 (모의: Gemini 대신 카드 렌더) + 카드 무료 생성
  await js(`__t.click('.toolbar button', '이미지')`)
  await wait(800)
  await idle()
  await check('이미지 모두 생성', async () => {
    const n = await js<number>(`[...document.querySelectorAll('.imgslot img')].filter(i => i.complete && i.naturalWidth > 0).length`)
    return n >= 3 ? `${n}장 표시` : 'FAIL ' + n
  })
  await shot('images')

  // 5. 미리보기
  await js(`__t.click('.toolbar button', '미리보기')`)
  await wait(900)
  await check('모바일 미리보기 (이미지 포함)', async () => ((await js<number>(`document.querySelectorAll('.phone img.pimg').length`)) > 0) || 'FAIL')
  await shot('preview')
  await js(`__t.click('.toolbar button', '편집')`)
  await wait(400)

  // 6. 네이버용 복사 → 클립보드 확인
  await js(`__t.click('button', '네이버용 서식 복사')`)
  await wait(600)
  await check('네이버용 서식 복사 (가운데 정렬·표·환자 질문색·전화번호)', async () => {
    const h = clipboard.readHTML()
    const ok = /text-align:center/.test(h) && /<table/.test(h) && /0507-0000-0000/.test(h)
    return ok ? `${h.length}자` : 'FAIL ' + h.slice(0, 200)
  })

  // 7. AI로 고치기 (모의)
  await js(`__t.click('.tag', 'AI 티 줄이기')`)
  await wait(600)
  await idle()
  await check('AI로 고치기 (전체)', async () => !(await js<boolean>(`!!document.querySelector('.progress.err')`)) || 'FAIL')

  // 8. 이미지 폴더 내보내기
  await check('이미지 폴더 내보내기', async () => {
    const dirs = await js<string>(`window.wg.call('posts.list', []).then(r => r.data[0].id)`)
    const r = await js<{ ok: boolean; data: string }>(`window.wg.call('images.export', [${JSON.stringify(dirs)}])`)
    const files = r.ok ? fs.readdirSync(r.data) : []
    return files.length ? `${files.length}개 파일` : 'FAIL'
  })

  // 9. 발행 등록 + 실제 순위 확인 (현재 블로그탭 1위 글로 등록해 1위가 나오는지)
  const top = await js<string>(`window.wg.call('battle.get', ['대구임플란트']).then(r => r.data.serp.blogTop[0].url)`)
  await js(`__t.set(document.querySelector('input[type=url][placeholder*="blog.naver.com"]'), ${JSON.stringify(top)})`)
  await wait(300)
  await js(`__t.click('button', '등록하고 순위 확인')`)
  await wait(800)
  await idle()
  await check('순위 추적 (실제 네이버)', async () => {
    const r = await js<{ data: { ranks: { blogTab: number | null }[] }[] }>(`window.wg.call('posts.list', [])`)
    const rank = r.data[0].ranks.at(-1)?.blogTab
    return rank ? `블로그탭 ${rank}위` : 'FAIL ' + JSON.stringify(r.data[0].ranks)
  })
  await shot('published')

  // 10. 나머지 화면
  for (const [label, name] of [['순위', 'ranks'], ['원고', 'posts'], ['키워드', 'keywords'], ['홈', 'home2']] as const) {
    await nav(label)
    await shot(name)
  }
  await check('키워드 확장 (자동완성)', async () => {
    await nav('키워드')
    await js(`__t.set(document.querySelector('input[placeholder*="대구임플란트"]'), '대구임플란트')`)
    await js(`__t.click('button', '확장')`)
    await until(`document.querySelectorAll('.tbl tbody tr').length > 3`, 60000)
    return `${await js<number>(`document.querySelectorAll('.tbl tbody tr').length`)}개`
  })
  await shot('keywords_done')
  await nav('설정')
  await check('비용 기록 (모의 = $0)', async () => (await js<string>(`__t.text()`)).includes('$0.00') || 'FAIL')
  await js(`document.documentElement.dataset.theme = 'dark'`)
  await nav('홈')
  await shot('dark')
  await js(`document.documentElement.dataset.theme = 'light'`)
  await nav('원고')
  await js(`document.querySelector('table .wl')?.click()`)
  await wait(900)
  await shot('light_editor')
  await nav('원고 작성')
  await wait(400)
  await shot('light_write')

  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(log, null, 2))
  const failed = log.filter((l) => !l.ok).length
  process.stdout.write(`[e2e] 완료: ${log.length - failed}/${log.length} 통과\n`)
  closeScraper()
  app.exit(failed ? 1 : 0)
}
