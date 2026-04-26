import { describe, expect, it } from 'vitest'
import { buildPrintHtml, currentPrintPageSettings, type PrintPageSettings } from './pdfExport'
import { useUIStore } from '../store/uiStore'
import { useTypographyStore } from '../store/typographyStore'

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

  it('uses running header and footer templates from page settings', () => {
    const out = buildPrintHtml('<p>Hello</p>', 'Memo', {
      ...landscapeGrid,
      runningHeader: '프로젝트 헤더',
      runningFooter: 'Page {page} / {total}',
    })

    expect(out).toContain('@top-left { content: "프로젝트 헤더";')
    expect(out).toContain('@bottom-right { content: "Page " counter(page) " / " counter(pages);')
  })

  it('keeps manual page breaks and typography settings in print output', () => {
    const out = buildPrintHtml('<p>One</p><hr class="jan-page-break" data-page-break="1" /><p>Two</p>', 'Memo', {
      ...landscapeGrid,
      fontFamily: 'serif',
      fontSize: 16,
      lineHeight: 1.9,
      paragraphSpacing: 12,
    })

    expect(out).toContain('font-family:"Noto Serif KR"')
    expect(out).toContain('font-size:12pt;line-height:1.9')
    expect(out).toContain('p{margin:0 0 12px;}')
    expect(out).toContain('.jan-page-break,hr.jan-page-break')
  })

  it('reads current settings from uiStore', () => {
    useUIStore.setState({
      paperStyle: 'dot',
      pageSize: 'A5',
      pageOrientation: 'portrait',
      pageMarginMm: 18,
      runningHeader: '헤더',
      runningFooter: '쪽 {page}',
    })
    useTypographyStore.setState({
      fontFamily: 'mono',
      fontSize: 13,
      lineHeight: 1.55,
      paragraphSpacing: 6,
    })

    expect(currentPrintPageSettings()).toMatchObject({
      paperStyle: 'dot',
      pageSize: 'A5',
      pageOrientation: 'portrait',
      pageMarginMm: 18,
      runningHeader: '헤더',
      runningFooter: '쪽 {page}',
      fontFamily: 'mono',
      fontSize: 13,
    })
  })
})
