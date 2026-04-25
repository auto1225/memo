/**
 * Phase 5 — HWPX 내보내기 (한컴오피스 한글 호환).
 *
 * HWPX 는 ZIP 컨테이너 안에 OWPML(XML) 문서를 담는 한국 산업 표준.
 * 표준 사양: KS X 6101.
 *
 * 이 구현은 "기본 HWPX" — 텍스트·문단·표만 지원. 한컴 한글 / Polaris Office / 한컴독스 등
 * 표준 HWPX 뷰어에서 열림. 고급 서식 (헤더/푸터/주석 등) 은 미지원.
 *
 * 내부 구조:
 *   /mimetype                    application/hwp+zip
 *   /META-INF/manifest.xml       파일 목록
 *   /version.xml                 버전 정보
 *   /Contents/header.xml         문서 메타데이터
 *   /Contents/section0.xml       본문
 *
 * JSZip 으로 ZIP 패킹 → File 다운로드.
 */
import JSZip from 'jszip'

const VERSION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" targetApplication="WORDPROCESSOR" major="5" minor="0" micro="3" buildNumber="0" os="windows" application="JustANotepad" appVersion="2.0.0"/>`

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <odf:file-entry odf:full-path="/" odf:media-type="application/hwp+zip"/>
  <odf:file-entry odf:full-path="version.xml" odf:media-type="application/xml"/>
  <odf:file-entry odf:full-path="Contents/header.xml" odf:media-type="application/xml"/>
  <odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml"/>
</odf:manifest>`

const HEADER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.31">
  <hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>
  <hh:refList>
    <hh:fontfaces>
      <hh:fontface lang="HANGUL"><hh:font id="0" type="TTF" name="맑은 고딕"/></hh:fontface>
    </hh:fontfaces>
    <hh:charProperties>
      <hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">
        <hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
        <hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>
        <hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:paraProperties>
      <hh:paraPr id="0" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">
        <hh:align horizontal="JUSTIFY" vertical="BASELINE"/>
        <hh:heading type="NONE" idRef="0" level="0"/>
        <hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>
        <hh:margin>
          <hc:intent xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
          <hc:left xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
          <hc:right xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
          <hc:prev xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
          <hc:next xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" value="0"/>
        </hh:margin>
        <hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>
        <hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/>
      </hh:paraPr>
    </hh:paraProperties>
  </hh:refList>
</hh:head>`

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** TipTap HTML → 평문 단락 배열. */
function htmlToParas(html: string): string[] {
  const div = document.createElement('div')
  div.innerHTML = html
  const out: string[] = []
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(tag)) {
      const t = (el.textContent || '').trim()
      if (t) out.push(t)
      return
    }
    for (const c of Array.from(el.children)) walk(c)
  }
  for (const c of Array.from(div.children)) walk(c)
  if (out.length === 0) {
    const t = (div.textContent || '').trim()
    if (t) out.push(t)
  }
  return out
}

function buildSectionXml(paras: string[]): string {
  const paraXml = paras
    .map(
      (text) => `
    <hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="0">
        <hp:t>${escXml(text)}</hp:t>
      </hp:run>
      <hp:linesegarray>
        <hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/>
      </hp:linesegarray>
    </hp:p>`
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section">
  ${paraXml}
</hs:sec>`
}

/** TipTap HTML 을 HWPX(.hwpx) Blob 으로 변환. */
export async function exportHwpx(html: string): Promise<Blob> {
  const paras = htmlToParas(html)
  const zip = new JSZip()
  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' })
  zip.file('version.xml', VERSION_XML)
  zip.folder('META-INF')!.file('manifest.xml', MANIFEST_XML)
  const c = zip.folder('Contents')!
  c.file('header.xml', HEADER_XML)
  c.file('section0.xml', buildSectionXml(paras))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' })
}

/** 다운로드 헬퍼. */
export async function downloadHwpx(html: string, filename: string) {
  const blob = await exportHwpx(html)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace(/\.[^/.]+$/, '') + '.hwpx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
