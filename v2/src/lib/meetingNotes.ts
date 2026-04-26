export type MeetingKind = 'meeting' | 'lecture'

export interface MeetingSegment {
  id: string
  speaker: string
  text: string
  startMs: number
  endMs: number
}

export interface MeetingActionItem {
  task: string
  owner: string
  due: string
}

export interface MeetingAnalysis {
  summary: string[]
  decisions: string[]
  actions: MeetingActionItem[]
  keywords: string[]
}

export interface MeetingHtmlInput {
  kind: MeetingKind
  title: string
  participants?: string
  agenda?: string
  segments: MeetingSegment[]
  analysis: MeetingAnalysis
  audioRef?: string
  audioName?: string
  createdAt?: Date
}

const ACTION_RE = /(해야|진행|담당|마감|까지|할 일|액션|follow|todo|due|owner|next)/i
const DECISION_RE = /(결정|확정|합의|승인|보류|채택|decision|agreed|approved)/i
const STOP_WORDS = new Set([
  '그리고', '그래서', '하지만', '오늘', '이번', '대한', '있는', '없는', '합니다', '입니다',
  '회의', '강의', '내용', '정리', '우리', '제가', '저희', 'the', 'and', 'for', 'with', 'that',
])

export function segmentId(): string {
  return 'seg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

export function segmentsToPlainText(segments: MeetingSegment[]): string {
  return segments
    .filter((segment) => segment.text.trim())
    .map((segment) => `[${formatClock(segment.startMs)}] ${segment.speaker}: ${segment.text.trim()}`)
    .join('\n')
}

export function analyzeTranscriptLocal(segments: MeetingSegment[] | string): MeetingAnalysis {
  const text = typeof segments === 'string'
    ? segments
    : segments.map((segment) => segment.text).join('\n')
  const sentences = splitSentences(text)
  const summary = sentences
    .sort((a, b) => scoreSentence(b) - scoreSentence(a))
    .slice(0, 5)
  const decisions = sentences.filter((sentence) => DECISION_RE.test(sentence)).slice(0, 8)
  const actions = sentences
    .filter((sentence) => ACTION_RE.test(sentence))
    .slice(0, 12)
    .map((sentence) => ({
      task: sentence,
      owner: extractOwner(sentence),
      due: extractDue(sentence),
    }))
  const keywords = extractKeywords(text)

  return {
    summary: summary.length ? summary : sentences.slice(0, 3),
    decisions,
    actions,
    keywords,
  }
}

export function buildSrt(segments: MeetingSegment[]): string {
  return segments
    .filter((segment) => segment.text.trim())
    .map((segment, index) => [
      String(index + 1),
      `${formatSrtTime(segment.startMs)} --> ${formatSrtTime(Math.max(segment.endMs, segment.startMs + 1000))}`,
      `${segment.speaker}: ${segment.text.trim()}`,
    ].join('\n'))
    .join('\n\n')
}

export function buildMeetingText(input: MeetingHtmlInput): string {
  const label = input.kind === 'lecture' ? '강의노트' : '회의노트'
  const lines = [
    `${label} - ${input.title}`,
    `생성: ${(input.createdAt || new Date()).toLocaleString('ko-KR')}`,
    input.participants ? `참석/수강: ${input.participants}` : '',
    input.agenda ? `안건/주제: ${input.agenda}` : '',
    '',
    '[요약]',
    ...listOrDash(input.analysis.summary),
    '',
    '[결정/핵심]',
    ...listOrDash(input.analysis.decisions),
    '',
    '[액션 아이템]',
    ...(input.analysis.actions.length
      ? input.analysis.actions.map((item) => `- ${item.task} / 담당: ${item.owner || '-'} / 기한: ${item.due || '-'}`)
      : ['- 없음']),
    '',
    '[전체 기록]',
    segmentsToPlainText(input.segments) || '기록 없음',
  ]
  return lines.filter((line, index) => line || lines[index - 1] !== '').join('\n')
}

export function buildMeetingHtml(input: MeetingHtmlInput): string {
  const label = input.kind === 'lecture' ? '강의노트' : '회의노트'
  const date = input.createdAt || new Date()
  const summary = listHtml(input.analysis.summary)
  const decisions = listHtml(input.analysis.decisions)
  const actions = input.analysis.actions.length
    ? input.analysis.actions.map((item) => `<tr><td>${esc(item.owner || '-')}</td><td>${esc(item.task)}</td><td>${esc(item.due || '-')}</td></tr>`).join('')
    : '<tr><td>-</td><td>액션 아이템 없음</td><td>-</td></tr>'
  const transcript = input.segments.length
    ? input.segments.map((segment) => `
      <li>
        <strong>${esc(formatClock(segment.startMs))} · ${esc(segment.speaker)}</strong>
        <span>${esc(segment.text)}</span>
      </li>`).join('')
    : '<li><span>기록 없음</span></li>'
  const audio = input.audioRef
    ? `<audio controls src="${escAttr(input.audioRef)}" style="width:100%;margin:8px 0;"></audio><p><small>${esc(input.audioName || '녹음 파일')}</small></p>`
    : ''

  return `
<section class="jan-meeting-note-block" data-kind="${input.kind}">
  <h2>${label} - ${esc(input.title || '제목 없음')}</h2>
  <p><strong>일시:</strong> ${esc(date.toLocaleString('ko-KR'))}</p>
  ${input.participants ? `<p><strong>${input.kind === 'lecture' ? '수강/참석' : '참석자'}:</strong> ${esc(input.participants)}</p>` : ''}
  ${input.agenda ? `<p><strong>${input.kind === 'lecture' ? '주제' : '안건'}:</strong> ${esc(input.agenda)}</p>` : ''}
  ${audio}
  <h3>요약</h3>
  ${summary}
  <h3>${input.kind === 'lecture' ? '핵심 개념' : '결정 사항'}</h3>
  ${decisions}
  <h3>액션 아이템</h3>
  <table><thead><tr><th>담당</th><th>할 일</th><th>기한</th></tr></thead><tbody>${actions}</tbody></table>
  <h3>전체 기록</h3>
  <ol class="jan-meeting-transcript">${transcript}</ol>
</section><p></p>`
}

export function downloadTextFile(name: string, text: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function formatSrtTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms))
  const hours = Math.floor(safe / 3_600_000)
  const minutes = Math.floor((safe % 3_600_000) / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1000)
  const millis = safe % 1000
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${String(millis).padStart(3, '0')}`
}

export function formatClock(ms: number): string {
  const safe = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${pad(seconds)}`
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？]|다\.|요\.|함\.|음\.)\s+|[\n\r]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 4)
}

function scoreSentence(sentence: string): number {
  let score = Math.min(sentence.length, 140)
  if (DECISION_RE.test(sentence)) score += 40
  if (ACTION_RE.test(sentence)) score += 30
  if (/[0-9%]/.test(sentence)) score += 8
  return score
}

function extractOwner(sentence: string): string {
  const before = sentence.match(/([가-힣A-Za-z0-9._-]{2,12})\s*담당/)
  if (before?.[1]) return before[1]
  const after = sentence.match(/(?:담당|owner)\s*[:：]?\s*([가-힣A-Za-z0-9._-]{2,12})/)
  return after?.[1] || ''
}

function extractDue(sentence: string): string {
  const match = sentence.match(/(\d{1,2}[./월-]\s*\d{1,2}일?|\d{4}-\d{2}-\d{2}|오늘|내일|이번 주|다음 주|금요일|월요일|화요일|수요일|목요일)/)
  return match?.[1]?.replace(/\s+/g, ' ') || ''
}

function extractKeywords(text: string): string[] {
  const counts = new Map<string, number>()
  const words = text.match(/[가-힣A-Za-z0-9]{2,}/g) || []
  for (const raw of words) {
    const word = raw.toLowerCase()
    if (STOP_WORDS.has(word) || word.length < 2) continue
    counts.set(word, (counts.get(word) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word)
}

function listHtml(items: string[]): string {
  const rows = listOrDash(items).map((item) => `<li>${esc(item.replace(/^- /, ''))}</li>`).join('')
  return `<ul>${rows}</ul>`
}

function listOrDash(items: string[]): string[] {
  return items.length ? items.map((item) => `- ${item}`) : ['- 없음']
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escAttr(value: string): string {
  return esc(value).replace(/'/g, '&#39;')
}
