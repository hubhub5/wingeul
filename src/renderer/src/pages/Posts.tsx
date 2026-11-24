import { useEffect, useState } from 'react'
import type { Post } from '@shared/types'
import { blocksToText, charCount } from '@shared/analysis/text'
import { useApp } from '../lib/ctx'
import { api, ymd } from '../lib/api'

export function Spark({ post }: { post: Post }) {
  const last = post.ranks.slice(-14)
  if (!last.length) return <span className="hint">—</span>
  return (
    <span className="spark" title={last.map((r) => `${r.date} ${r.blogTab ?? '권외'}`).join('\n')}>
      {last.map((r) => (r.blogTab ? <i key={r.date} style={{ height: `${Math.max(3, 22 - r.blogTab * 2)}px` }} /> : <i key={r.date} className="none" />))}
    </span>
  )
}

export default function Posts() {
  const { clientId, clients, openPost } = useApp()
  const [posts, setPosts] = useState<Post[]>([])
  const [all, setAll] = useState(false)
  const load = () => api('posts.list', all ? undefined : clientId || undefined).then(setPosts)
  useEffect(() => { void load() }, [clientId, all])

  async function del(p: Post) {
    if (!confirm(`"${p.title}"을(를) 삭제할까요?`)) return
    await api('posts.delete', p.id)
    void load()
  }

  return (
    <>
      <div className="page-head">
        <div className="kicker mono"><span>원고 {posts.length}편</span><label><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> 모든 업체</label></div>
        <h1>원고 목록</h1>
      </div>
      {posts.length === 0 ? (
        <div className="empty">아직 원고가 없습니다. 원고 작성에서 첫 원고를 만들어 보세요.</div>
      ) : (
        <div className="scroll-x">
          <table className="tbl">
            <thead><tr><th>작성</th><th>업체</th><th>키워드</th><th>제목</th><th>글자</th><th>상태</th><th>블로그탭 순위</th><th /></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{ymd(p.createdAt)}</td>
                  <td className="hint">{clients.find((c) => c.id === p.clientId)?.name ?? '—'}</td>
                  <td>{p.keyword}</td>
                  <td><button className="wl" onClick={() => openPost(p)}>{p.title}</button></td>
                  <td className="mono">{charCount(blocksToText(p.blocks)).withSpace}</td>
                  <td>{p.status === 'published' ? <span className="tag on">발행</span> : <span className="tag">초안</span>}</td>
                  <td><Spark post={p} /> <span className="mono">{p.ranks.at(-1)?.blogTab ?? ''}</span></td>
                  <td><button className="btn sm ghost" onClick={() => del(p)}>삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
