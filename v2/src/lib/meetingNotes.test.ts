import { describe, expect, it } from 'vitest'
import {
  analyzeTranscriptLocal,
  buildMeetingHtml,
  buildMeetingText,
  buildSrt,
  formatSrtTime,
  type MeetingSegment,
} from './meetingNotes'

const segments: MeetingSegment[] = [
  {
    id: 's1',
    speaker: '발언 1',
    text: '오늘 회의에서는 v2 동기화 정책을 확정했습니다.',
    startMs: 0,
    endMs: 2500,
  },
  {
    id: 's2',
    speaker: '발언 2',
    text: '민수 담당으로 다음 주까지 Dropbox 백업 테스트를 진행해야 합니다.',
    startMs: 2500,
    endMs: 7000,
  },
]

describe('meeting notes helpers', () => {
  it('formats SRT timestamps and transcript blocks', () => {
    expect(formatSrtTime(3_723_456)).toBe('01:02:03,456')

    const srt = buildSrt(segments)
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500')
    expect(srt).toContain('발언 2: 민수 담당으로 다음 주까지 Dropbox 백업 테스트를 진행해야 합니다.')
  })

  it('extracts local summaries, decisions, and action items', () => {
    const analysis = analyzeTranscriptLocal(segments)

    expect(analysis.decisions[0]).toContain('확정')
    expect(analysis.actions[0].task).toContain('진행해야')
    expect(analysis.actions[0].owner).toBe('민수')
    expect(analysis.actions[0].due).toBe('다음 주')
  })

  it('builds insertable meeting html and export text', () => {
    const analysis = analyzeTranscriptLocal(segments)
    const html = buildMeetingHtml({
      kind: 'meeting',
      title: '동기화 점검',
      participants: '민수, 지현',
      agenda: 'v2 출시',
      segments,
      analysis,
      audioRef: 'jan-blob://audio1',
      audioName: 'meeting.webm',
      createdAt: new Date('2026-04-26T09:00:00+09:00'),
    })
    const text = buildMeetingText({
      kind: 'meeting',
      title: '동기화 점검',
      segments,
      analysis,
      createdAt: new Date('2026-04-26T09:00:00+09:00'),
    })

    expect(html).toContain('회의노트 - 동기화 점검')
    expect(html).toContain('<audio controls src="jan-blob://audio1"')
    expect(html).toContain('<table>')
    expect(text).toContain('[액션 아이템]')
    expect(text).toContain('Dropbox 백업 테스트')
  })
})
