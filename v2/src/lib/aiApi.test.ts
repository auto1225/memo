import { afterEach, describe, expect, it, vi } from 'vitest'
import { runAiVision } from './aiApi'
import { useSettingsStore } from '../store/settingsStore'

describe('AI API utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useSettingsStore.getState().reset()
  })

  it('does not call the server proxy when AI provider is disabled', async () => {
    useSettingsStore.getState().reset()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAiVision('명함 정보를 추출하세요', 'data:image/png;base64,aaa')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('꺼져')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
