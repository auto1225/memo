import { describe, expect, it } from 'vitest'
import {
  clampTypographySettings,
  detectTypographyPreset,
  getTypographyPreset,
  normalizeFontFamily,
} from './typographyStore'

describe('typographyStore helpers', () => {
  it('normalizes unknown font families to the default', () => {
    expect(normalizeFontFamily('serif')).toBe('serif')
    expect(normalizeFontFamily('unknown')).toBe('sans')
  })

  it('clamps settings to readable document limits', () => {
    expect(clampTypographySettings({
      fontFamily: 'mono',
      fontSize: 42,
      lineHeight: 0.8,
      paragraphSpacing: -4,
    })).toEqual({
      fontFamily: 'mono',
      fontSize: 22,
      lineHeight: 1.2,
      paragraphSpacing: 0,
    })
  })

  it('detects a preset from exact typography settings', () => {
    const preset = getTypographyPreset('manuscript')

    expect(detectTypographyPreset(preset)).toBe('manuscript')
    expect(detectTypographyPreset({ ...preset, fontSize: preset.fontSize + 1 })).toBe('custom')
  })
})
