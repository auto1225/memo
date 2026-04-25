import { describe, it, expect } from 'vitest'
import { makeShareUrl, readShareFragment } from './shareLink'

describe('shareLink', () => {
  it('round-trips short payload', async () => {
    const orig = { v: 1 as const, title: 'Test', content: '<p>Hello</p>', createdAt: Date.now() }
    const url = await makeShareUrl(orig)
    expect(url).toContain('#share=')
    expect(url).toContain('/v2/')

    // 시뮬레이트: location.hash 에 fragment 주입 후 read
    const fragMatch = url.match(/#(.+)$/)
    expect(fragMatch).toBeTruthy()
    const hashStr = fragMatch![1]
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hash: '#' + hashStr },
      writable: true,
    })
    const decoded = await readShareFragment()
    expect(decoded).toEqual(orig)
  })

  it('handles unicode (Korean/Japanese)', async () => {
    const orig = { v: 1 as const, title: '한글 제목 テスト', content: '<p>안녕하세요 こんにちは</p>', createdAt: 1000 }
    const url = await makeShareUrl(orig)
    const fragMatch = url.match(/#(.+)$/)
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hash: '#' + fragMatch![1] },
      writable: true,
    })
    const decoded = await readShareFragment()
    expect(decoded?.title).toBe('한글 제목 テスト')
    expect(decoded?.content).toContain('안녕하세요')
  })

  it('uses gzip for large content', async () => {
    const big = { v: 1 as const, title: 'big', content: 'x'.repeat(5000), createdAt: 0 }
    const url = await makeShareUrl(big)
    expect(url).toMatch(/#share=g:/)
  })
})
