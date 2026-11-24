import { useEffect, useState } from 'react'
import type { Post } from '@shared/types'
import { useApp } from '../lib/ctx'
import { api, ymd } from '../lib/api'
import { Spark } from './Posts'

export default function Ranks() {
  const { clientId, clients, run, busy, openPost } = useApp()
  const [posts, setPosts] = useState<Post[]>([])
  const [report, setReport] = useState(false)
  const client = clients.find((c) => c.id === clientId)
  const load = () => api('posts.list', clientId || undefined).then((ps) => setPosts(ps.filter((p) => p.status === 'published')))
  useEffect(() => { void load() }, [clientId])

  async function checkAll() {
    await run('순위 확인', () => api('rank.trackAll'))
    void load()
  }
  async function checkOne(p: Post) {
    await run('순위 확인', () => api('rank.track', p.id))
    void load()
  }

  const month = new Date().toISOString().slice(0, 7)
  const inTop = (n: number) => posts.filter((p) => (p.ranks.at(-1)?.blogTab ?? 99) <= n).length

  return (
    <>
      <div className="page-head">
        <div className="kicker mono"><span>발행 {posts.length}편</span><span>{client?.name ?? '전체 업체'}</span></div>
        <h1>순위 체크</h1>
        <p>발행한 원고의 블로그탭·통합검색 순위를 하루 한 번 기록합니다. 기록이 쌓이면 어떤 컨셉과 제목이 실제로 오르는지 보입니다.</p>
      </div>
      <div className="btns" style={{ marginBottom: 20 }}>
        <button className="btn pri" disabled={busy} onClick={checkAll}>오늘 순위 모두 확인</button>
        <button className="btn ghost" onClick={() => setReport(!report)}>{report ? '목록으로' : '월간 보고서'}</button>
        {report && <button className="btn ghost" onClick={() => window.print()}>인쇄·PDF 저장</button>}
      </div>

      <div className="stats">
        <div><span className="mono">블로그탭 1~3위</span><b>{inTop(3)}</b><small>편</small></div>
        <div><span className="mono">4~10위</span><b>{inTop(10) - inTop(3)}</b><small>편</small></div>
        <div><span className="mono">권외·미확인</span><b>{posts.length - inTop(10)}</b><small>편</small></div>
      </div>

      {report ? (
        <section className="sec">
          <div className="sec-h"><span className="mono">{month}</span><h2>{client?.name ?? '전체'} 월간 블로그 보고서</h2></div>
          <table className="tbl">
            <thead><tr><th>발행일</th><th>키워드</th><th>제목</th><th>최근 블로그탭</th><th>최근 통합검색</th><th>최고 순위</th></tr></thead>
            <tbody>
              {posts.map((p) => {
                const best = Math.min(...p.ranks.map((r) => r.blogTab ?? 99))
                const last = p.ranks.at(-1)
                return (
                  <tr key={p.id}>
                    <td className="mono">{ymd(p.createdAt)}</td><td>{p.keyword}</td><td>{p.title}</td>
                    <td className="mono">{last?.blogTab ?? '권외'}</td><td className="mono">{last?.integrated ?? '권외'}</td><td className="mono">{best === 99 ? '—' : best}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 12 }}>순위는 확인 시점 기준이며 검색 위치·개인화에 따라 다를 수 있습니다.</p>
        </section>
      ) : posts.length === 0 ? (
        <div className="empty">발행 등록된 글이 없습니다. 에디터의 발행 칸에 글 주소를 넣으면 추적을 시작합니다.</div>
      ) : (
        <table className="tbl">
          <thead><tr><th>키워드</th><th>제목</th><th>추이 (14일)</th><th>블로그탭</th><th>통합검색</th><th>확인일</th><th /></tr></thead>
          <tbody>
            {posts.map((p) => {
              const last = p.ranks.at(-1)
              const prev = p.ranks.at(-2)
              const delta = last?.blogTab && prev?.blogTab ? prev.blogTab - last.blogTab : 0
              return (
                <tr key={p.id}>
                  <td>{p.keyword}</td>
                  <td><button className="wl" onClick={() => openPost(p)}>{p.title}</button></td>
                  <td><Spark post={p} /></td>
                  <td className="mono">{last?.blogTab ?? '권외'} {delta > 0 ? `+${delta}` : delta < 0 ? delta : ''}</td>
                  <td className="mono">{last?.integrated ?? '권외'}</td>
                  <td className="mono">{last?.date ?? '—'}</td>
                  <td><button className="btn sm ghost" disabled={busy} onClick={() => checkOne(p)}>확인</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
