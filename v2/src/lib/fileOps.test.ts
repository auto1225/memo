import { afterEach, describe, expect, it, vi } from 'vitest'
import { openFile } from './fileOps'

describe('fileOps', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as any).showOpenFilePicker
    document.body.innerHTML = ''
  })

  it('opens HTML through an input fallback when File System Access is unavailable', async () => {
    delete (window as any).showOpenFilePicker
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      const file = new File(['<!doctype html><html><body><h1>Fallback Open</h1><p>Loaded.</p></body></html>'], 'fallback.html', { type: 'text/html' })
      Object.defineProperty(this, 'files', { configurable: true, value: [file] })
      this.dispatchEvent(new Event('change'))
    })

    const result = await openFile()

    expect(click).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      title: 'fallback',
      content: '<h1>Fallback Open</h1><p>Loaded.</p>',
      handle: null,
    })
  })

  it('falls back to input when File System Access open fails for a non-cancel error', async () => {
    ;(window as any).showOpenFilePicker = vi.fn(async () => {
      throw new Error('blocked')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      const file = new File(['<body><p>Recovered</p></body>'], 'recovered.htm', { type: 'text/html' })
      Object.defineProperty(this, 'files', { configurable: true, value: [file] })
      this.dispatchEvent(new Event('change'))
    })

    const result = await openFile()

    expect(result?.title).toBe('recovered')
    expect(result?.content).toBe('<p>Recovered</p>')
    expect(result?.handle).toBeNull()
  })

  it('does not show the fallback picker when File System Access is canceled', async () => {
    ;(window as any).showOpenFilePicker = vi.fn(async () => {
      throw new DOMException('Canceled', 'AbortError')
    })
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    await expect(openFile()).resolves.toBeNull()
    expect(click).not.toHaveBeenCalled()
  })
})
