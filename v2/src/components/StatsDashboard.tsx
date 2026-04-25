import { useMemo } from 'react'
import { useMemosStore } from '../store/memosStore'
import { useTagsStore } from '../store/tagsStore'

interface StatsDashboardProps {
  onClose: () => void
}

/**
 * Phase 12 — 메모 통계 대시보드.
 * 총 메모, 총 글자, 평균 글자, 가장 큰 메모, 태그 분포, 일자별 작성량 (지난 30일).
 */
export function StatsDashboard({ onClose }: StatsDashboardProps) {
  const memos = useMemosStore((s) => s.memos)
  const tagsByMemo = useTagsStore((s) => s.byMemo)

  const stats = useMemo(() => {
    const arr = Object.values(memos)
    const totalChars = arr.reduce((a, m) => a + plainLen(m.content), 0)
    const avgChars = arr.length > 0 ? Math.round(totalChars / arr.length) : 0
    const sorted = [...arr].sort((a, b) => plainLen(b.content) - plainLen(a.content))
    const biggest = sorted.slice(0, 5).map((m) => ({ id: m.id, title: m.title, size: plainLen(m.content) }))

    // 태그 분포
    const tagCount: Record<string, number> = {}
    for (const tags of Object.values(tagsByMemo)) {
      for (const t of tags) tagCount[t] = (tagCount[t] || 0) + 1
    }
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8)

    // 지난 30일 일자별 메모 갯수 (createdAt 기반)
    const buckets: Record<string, number> = {}
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      buckets[ymd(d)] = 0
    }
    for (const m of arr) {
      const k = ymd(new Date(m.createdAt))
      if (k in buckets) buckets[k]++
    }
    const series = Object.entries(buckets)
    const maxV = Math.max(1, ...series.map(([, v]) => v))

    return {
      totalMemos: arr.length,
      totalChars,
      avgChars,
      biggest,
      topTags,
      series,
      maxV,
    }
  }, [memos, tagsByMemo])

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>메모 통계</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-stats-grid">
            <Card label="총 메모" value={stats.totalMemos.toLocaleString()} />
            <Card label="총 글자" value={stats.totalChars.toLocaleString()} />
            <Card label="평균 글자/메모" value={stats.avgChars.toLocaleString()} />
            <Card label="태그" value={stats.topTags.length.toString()} />
          </div>

          <h4>지난 30일 작성량</h4>
          <div className="jan-stats-bars" aria-label="30일 작성량 막대 그래프">
            {stats.series.map(([day, v]) => (
              <div key={day} className="jan-stats-bar" title={`${day}: ${v}개`}>
                <div className="jan-stats-bar-fill" style={{ height: `${(v / stats.maxV) * 100}%` }} />
              </div>
            ))}
          </div>

          <h4>가장 긴 메모 (top 5)</h4>
          <ul className="jan-stats-list">
            {stats.biggest.map((m) => (
              <li key={m.id}>
                <span className="jan-stats-title">{m.title || '무제'}</span>
                <span className="jan-stats-num">{m.size.toLocaleString()}자</span>
              </li>
            ))}
          </ul>

          <h4>인기 태그</h4>
          <div className="jan-stats-tags">
            {stats.topTags.map(([t, c]) => (
              <span key={t} className="jan-tag">#{t} ({c})</span>
            ))}
            {stats.topTags.length === 0 && <span className="jan-stats-empty">태그 없음</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="jan-stats-card">
      <div className="jan-stats-card-label">{label}</div>
      <div className="jan-stats-card-value">{value}</div>
    </div>
  )
}

function plainLen(html: string): number {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
