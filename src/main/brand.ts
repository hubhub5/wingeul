// 브랜드 화면: 스플래시 창 HTML, 앱 아이콘 HTML. 같은 HTML을 PNG로도 렌더링해 배포물(build/)에 쓴다.

import { fontFaceCss } from './fonts'

const fontFace = () => fontFaceCss()

const MARK = (stroke: string, dot: string, w = 2.6) =>
  `<svg viewBox="0 0 32 32" fill="none"><path d="M5 9l5.5 15L16 11l5.5 13L27 9" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="6" r="2" fill="${dot}"/></svg>`

/** 스플래시 (720×440). still=true면 애니메이션 없이 정지 화면 (PNG 렌더용) */
export function splashHtml(version: string, still = false): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:720px;height:440px;overflow:hidden;background:transparent}
.card{position:relative;width:720px;height:440px;border-radius:28px;overflow:hidden;
  background:radial-gradient(900px 520px at 88% -20%, #3b6a60 0%, transparent 55%),
             radial-gradient(700px 480px at -10% 120%, #1b3530 0%, transparent 60%),
             linear-gradient(155deg, #14231f 0%, #1c3530 55%, #24453f 100%);
  font-family:'NanumSquareNeo',-apple-system,sans-serif;letter-spacing:-0.07em;color:#f1ece2;-webkit-font-smoothing:antialiased}
.card::before{content:'';position:absolute;inset:0;opacity:.07;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.ring{position:absolute;right:-120px;top:-120px;width:420px;height:420px;border-radius:50%;border:1px solid rgba(208,181,130,.22)}
.ring.b{right:-60px;top:-60px;width:300px;height:300px;border-color:rgba(208,181,130,.12)}
.in{position:absolute;left:64px;top:64px;right:64px;bottom:56px;display:flex;flex-direction:column}
.mark{width:58px;height:58px;border-radius:18px;background:rgba(241,236,226,.08);border:1px solid rgba(208,181,130,.35);display:grid;place-items:center}
.mark svg{width:30px;height:30px}
.word{margin-top:auto;font-size:64px;font-weight:300;letter-spacing:-0.07em;line-height:1}
.word b{font-weight:800}
.ko{margin-top:14px;font-size:16px;font-weight:400;letter-spacing:0.04em;color:rgba(241,236,226,.72)}
.foot{margin-top:34px;display:flex;align-items:center;gap:16px}
.line{flex:1;height:1px;background:rgba(241,236,226,.14);position:relative;overflow:hidden}
.line i{position:absolute;left:0;top:0;height:1px;width:${still ? '100%' : '0'};background:linear-gradient(90deg,#d0b582,#f1e3c2);${still ? '' : 'animation:load 1.6s cubic-bezier(.2,0,0,1) forwards'}}
.ver{font-size:12px;letter-spacing:.08em;color:#d0b582;font-weight:700}
.fade{${still ? '' : 'animation:in .9s cubic-bezier(.2,0,0,1) both'}}
.fade.d2{animation-delay:.12s}.fade.d3{animation-delay:.24s}
@keyframes load{to{width:100%}}
@keyframes in{from{opacity:0;transform:translateY(10px)}}
</style></head><body><div class="card"><div class="ring"></div><div class="ring b"></div>
<div class="in"><div class="mark fade">${MARK('#f1ece2', '#d0b582')}</div>
<div class="word fade d2">Win<b>Geul</b></div>
<div class="ko fade d3">블로그 상위노출 원고 관리</div>
<div class="foot"><div class="line"><i></i></div><span class="ver">VERSION ${version}</span></div></div></div></body></html>`
}

/** 앱 아이콘 (1024×1024, macOS 스타일 둥근 사각형) */
export function iconHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}html,body{width:1024px;height:1024px;background:transparent;overflow:hidden}
.i{position:absolute;left:100px;top:100px;width:824px;height:824px;border-radius:186px;
  background:radial-gradient(700px 600px at 85% 0%, #3f7166 0%, transparent 60%),linear-gradient(155deg,#16271f 0%,#24453f 100%);
  box-shadow:inset 0 0 0 2px rgba(208,181,130,.35);display:grid;place-items:center}
.i svg{width:470px;height:470px}
</style></head><body><div class="i">${MARK('#f1ece2', '#d0b582', 2.4)}</div></body></html>`
}
