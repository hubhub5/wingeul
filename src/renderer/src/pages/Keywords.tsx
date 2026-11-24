import { useState } from 'react'
import { useApp } from '../lib/ctx'
import { api } from '../lib/api'

export default function Keywords() {
  const { run, busy, setKeyword, go } = useApp()
  const [seed, setSeed] = useState('')
  const [list, setList] = useState<string[]>([])
  const [filter, setFilter] = useState('')

  async function expand() {
    const r = await run('키워드 확장', () => api('keyword.expand', seed.trim()))
    if (r) setList(r)
  }

  const shown = list.filter((k) => !filter || k.includes(filter))

  return (
    <>
      <div className="page-head">
        <div className="kicker"><span>키워드 발굴</span><span>비용 없음</span></div>
        <h1>키워드 발굴</h1>
        <p>시드 키워드에 ㄱ~ㅎ·비용·후기·추천을 붙여 자동완성을 펼칩니다. 고른 키워드로 바로 원고를 작성합니다.</p>
      </div>
      <div className="btns" style={{ marginBottom: 20, maxWidth: 720 }}>
        <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && expand()} placeholder="예: 대구임플란트" style={{ flex: 1 }} />
        <button className="btn pri" disabled={busy || !seed.trim()} onClick={expand}>확장</button>
      </div>
      {list.length > 0 && (
        <>
          <div className="btns" style={{ marginBottom: 12 }}>
            <span className="mono mute">{shown.length} / {list.length}</span>
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="걸러내기" style={{ width: 200 }} />
          </div>
          <table className="tbl">
            <tbody>
              {shown.map((k, i) => (
                <tr key={k}>
                  <td className="mono" style={{ width: 40 }}>{i + 1}</td>
                  <td>{k}</td>
                  <td className="right"><button className="btn sm" onClick={() => { setKeyword(k); go('war') }}>원고 작성</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 12 }}>월간 검색량·경쟁도(빈집 지수)는 네이버 검색광고 API 키 연동 후 표시됩니다 (다음 단계).</p>
        </>
      )}
    </>
  )
}
