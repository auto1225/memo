import { describe, it, expect } from 'vitest'
import { htmlToMd, mdToHtml } from './markdownIO'

describe('markdownIO', () => {
  it('htmlToMd: heading', () => {
    expect(htmlToMd('<h1>Title</h1>').trim()).toBe('# Title')
    expect(htmlToMd('<h3>Sub</h3>').trim()).toBe('### Sub')
  })

  it('htmlToMd: bold/italic/strike', () => {
    expect(htmlToMd('<p><strong>b</strong> <em>i</em> <s>s</s></p>').trim()).toBe('**b** *i* ~~s~~')
  })

  it('htmlToMd: link', () => {
    expect(htmlToMd('<p><a href="https://x.com">x</a></p>').trim()).toBe('[x](https://x.com)')
  })

  it('htmlToMd: code block', () => {
    const out = htmlToMd('<pre><code>const x = 1</code></pre>')
    expect(out).toContain('```')
    expect(out).toContain('const x = 1')
  })

  it('htmlToMd: bulleted list', () => {
    const out = htmlToMd('<ul><li>a</li><li>b</li></ul>').trim()
    expect(out).toContain('- a')
    expect(out).toContain('- b')
  })

  it('mdToHtml: heading', () => {
    expect(mdToHtml('# Title').trim()).toContain('<h1>Title</h1>')
  })

  it('mdToHtml: bold', () => {
    expect(mdToHtml('Hello **world**')).toContain('<strong>world</strong>')
  })

  it('mdToHtml: code block', () => {
    const out = mdToHtml('```\nx = 1\n```')
    expect(out).toContain('<pre><code>')
    expect(out).toContain('x = 1')
  })

  it('round trip: simple paragraph', () => {
    const md = '# Hello\n\nThis is **bold** text.\n'
    const html = mdToHtml(md)
    const back = htmlToMd(html)
    expect(back).toContain('# Hello')
    expect(back).toContain('**bold**')
  })
})
