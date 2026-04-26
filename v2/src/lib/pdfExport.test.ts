import { describe, expect, it } from 'vitest'
import { buildPrintHtml, currentPrintPageSettings, type PrintPageSettings } from './pdfExport'
import { useUIStore } from '../store/uiStore'

const landscapeGrid: PrintPageSettings = {
  paperStyle: 'grid',
  pageSize: 'Letter',
  pageOrientation: 'landscape',
  pageMarginMm: 12,
}

describe('pdfExport print document', () => {
  it('uses the requested page size, orientation, and margin', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', landscapeGrid)

    expect(out).toContain('@page { size: 279mm 216mm; margin: 12mm;')
    expect(out).toContain('data-paper="grid"')
    expect(out).toContain('repeating-linear-gradient(to right, transparent 0, transparent 19px')
  })

  it('keeps blank paper visually blank', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      paperStyle: 'blank',
    })

    expect(out).toContain('data-paper="blank"')
    expect(out).toContain('background-image:none')
  })

  it('escapes title contexts and can omit the preview header for PDF export', () => {
    const out = buildPrintHtml('<p>Hello</p>', '<Memo "One">', landscapeGrid, {
      includeHeaderTitle: false,
    })

    expect(out).toContain('<title>&lt;Memo &quot;One&quot;&gt;</title>')
    expect(out).not.toContain('@top-right')
  })

  it('reads current settings from uiStore', () => {
    useUIStore.setState({
      paperStyle: 'dot',
      pageSize: 'A5',
      pageOrientation: 'portrait',
      pageMarginMm: 18,
    })

    expect(currentPrintPageSettings()).toMatchObject({
      paperStyle: 'dot',
      pageSize: 'A5',
      pageOrientation: 'portrait',
      pageMarginMm: 18,
    })
  })
})
