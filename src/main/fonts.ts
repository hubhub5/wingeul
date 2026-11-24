// 나눔스퀘어 네오 (앱에 포함). 화면은 CSS로, 카드 이미지·스플래시는 이 @font-face로 같은 글꼴을 쓴다.

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

const WEIGHTS: [string, number][] = [['aLt', 300], ['bRg', 400], ['cBd', 700], ['dEb', 800], ['eHv', 900]]

export function fontDir(): string {
  const packaged = path.join(process.resourcesPath ?? '', 'fonts')
  if (app.isPackaged && fs.existsSync(packaged)) return packaged
  return path.join(app.getAppPath(), 'resources', 'fonts')
}

/** file:// 로 로드되는 HTML에서 쓰는 @font-face 묶음. family 이름은 'NanumSquareNeo' */
export function fontFaceCss(): string {
  const dir = fontDir()
  return WEIGHTS.map(([k, w]) => {
    const f = path.join(dir, `NanumSquareNeo-${k}.woff2`)
    return fs.existsSync(f) ? `@font-face{font-family:'NanumSquareNeo';font-weight:${w};src:url('${pathToFileURL(f).toString()}') format('woff2');}` : ''
  }).join('\n')
}
