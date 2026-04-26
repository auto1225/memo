import { describe, expect, it, beforeEach } from 'vitest'
import { localFirstStorage, readPersistedJson } from './localFirstStorage'

describe('localFirstStorage', () => {
  beforeEach(async () => {
    localStorage.clear()
    await localFirstStorage.removeItem('jan:test')
    await localFirstStorage.removeItem('jan:legacy')
    await localFirstStorage.removeItem('jan:json')
  })

  it('stores and reads values through the available device backend', async () => {
    await localFirstStorage.setItem('jan:test', 'hello')
    await expect(localFirstStorage.getItem('jan:test')).resolves.toBe('hello')
  })

  it('reads existing localStorage values for migration compatibility', async () => {
    localStorage.setItem('jan:legacy', 'old-value')
    await expect(localFirstStorage.getItem('jan:legacy')).resolves.toBe('old-value')
  })

  it('parses persisted JSON payloads', async () => {
    await localFirstStorage.setItem('jan:json', JSON.stringify({ state: { ok: true }, version: 1 }))
    await expect(readPersistedJson<{ ok: boolean }>('jan:json')).resolves.toEqual({
      state: { ok: true },
      version: 1,
    })
  })
})
