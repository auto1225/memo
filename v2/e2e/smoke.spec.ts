import { test, expect } from '@playwright/test'

/**
 * Phase 8 — JustANotepad v2 smoke E2E.
 * 라이브 https://justanotepad.com/v2/ 또는 로컬 dev 서버.
 */

test.describe('v2 smoke', () => {
  test('app loads and renders editor', async ({ page }) => {
    await page.goto('./')
    // 툴바 + ProseMirror 가 보이는지
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: '파일' })).toBeVisible()
  })

  test('typing in editor saves to memo', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible' })
    await editor.click()
    await page.keyboard.type('Hello E2E ' + Date.now())
    // 입력이 화면에 보이는지
    await expect(editor).toContainText('Hello E2E')
  })

  test('opens AI helper modal with Ctrl+/', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor()
    await page.keyboard.press('Control+/')
    await expect(page.locator('.jan-ai-modal')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('opens search panel with Ctrl+Shift+F', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor()
    await page.keyboard.press('Control+Shift+F')
    await expect(page.locator('.jan-search-modal')).toBeVisible()
  })

  test('keyboard help opens with F1', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor()
    await page.keyboard.press('F1')
    await expect(page.locator('.jan-help-modal')).toBeVisible()
  })

  test('MS Word shortcuts keep Ctrl+K for links and Ctrl+Shift+P for commands', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.type('OpenAI')
    await page.keyboard.press('Control+A')

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('링크 URL')
      await dialog.accept('https://openai.com')
    })
    await page.keyboard.press('Control+K')
    await expect(editor.locator('a[href="https://openai.com"]')).toContainText('OpenAI')

    await page.keyboard.press('Control+Shift+P')
    await expect(page.locator('.jan-cp')).toBeVisible()
  })

  test('list indentation follows Word-style Tab and Shift+Tab behavior', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('- ')
    await page.keyboard.type('Parent')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Child')
    await expect(editor.locator('ul > li', { hasText: 'Child' })).toHaveCount(1)

    await page.keyboard.press('Tab')
    await expect(editor.locator('ul ul li', { hasText: 'Child' })).toHaveCount(1)

    await page.keyboard.press('Shift+Tab')
    await expect(editor.locator('ul ul li', { hasText: 'Child' })).toHaveCount(0)
  })

  test('toolbar buttons present', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor()
    for (const label of ['논문', '서식', '삽입', '페이지', '미디어', '도구', '보기', '파일']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 5000 })
    }
    await page.getByRole('button', { name: '파일', exact: true }).click()
    await expect(page.getByRole('button', { name: '저장 Ctrl+S' })).toBeVisible()
    await expect(page.getByRole('button', { name: /HWPX/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Markdown/ })).toBeVisible()
    await page.getByRole('button', { name: '페이지', exact: true }).click()
    await expect(page.getByRole('button', { name: /페이지 크기 설정/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /노트 배경 스타일/ })).toBeVisible()
    await page.getByRole('button', { name: /페이지 크기 설정/ }).click()
    await expect(page.locator('.jan-page-settings-modal')).toBeVisible()
  })

  test('v1 note paper default and page settings are available', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    const pages = page.locator('.jan-editor-pages').first()
    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-paper', 'lined')
    await expect(pages).toHaveAttribute('data-page-size', 'A4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'portrait')
    await expect(pages).toHaveAttribute('data-page-columns', '1')
    await expect(page.locator('.jan-page-running-footer')).toHaveCount(0)
    const ruler = page.getByRole('img', { name: /가로 페이지 눈금자/ })
    const verticalRuler = page.getByRole('img', { name: /세로 페이지 눈금자/ })
    await expect(ruler).toBeVisible()
    await expect(verticalRuler).toBeVisible()
    await expect(ruler.locator('.jan-page-ruler-margin-left')).toContainText('20mm')
    await expect(ruler.locator('.jan-page-ruler-margin-right')).toContainText('20mm')
    await expect(verticalRuler.locator('.jan-page-vertical-ruler-margin-top')).toContainText('20mm')
    await expect(verticalRuler.locator('.jan-page-vertical-ruler-margin-bottom')).toContainText('20mm')
    const pageStatus = page.getByRole('button', { name: '상태바 페이지 설정' })
    await expect(pageStatus).toContainText('인쇄')
    await expect(pageStatus).toContainText('A4')
    await expect(pageStatus).toContainText('세로')
    await expect(pageStatus).toContainText('여백 20mm')

    await pageStatus.click()
    await expect(page.locator('.jan-page-settings-modal')).toBeVisible()
    await page.locator('.jan-page-settings-modal').getByLabel('닫기').click()

    const backgroundImage = await editor.evaluate((node) => getComputedStyle(node).backgroundImage)
    expect(backgroundImage).toContain('repeating-linear-gradient')

    await page.getByRole('button', { name: '설정', exact: true }).click()
    await expect(page.locator('.jan-settings-modal')).toBeVisible()
    await page.getByRole('button', { name: '페이지 설정 열기' }).click()
    await expect(page.locator('.jan-page-settings-modal')).toBeVisible()
    await expect(page.locator('.jan-page-size-card', { hasText: 'A3' })).toBeVisible()
    await expect(page.locator('.jan-page-size-card', { hasText: 'B4' })).toBeVisible()
    await expect(page.locator('.jan-paper-style-card', { hasText: '줄노트' })).toBeVisible()

    await page.locator('.jan-page-size-card', { hasText: 'B4' }).click()
    await page.getByRole('button', { name: '가로' }).click()
    await page.getByRole('button', { name: '2단' }).click()
    await page.locator('.jan-paper-style-card', { hasText: '모눈종이' }).click()
    await page.getByLabel('위 여백 mm').fill('12')
    await page.getByLabel('오른쪽 여백 mm').fill('16')
    await page.getByLabel('아래 여백 mm').fill('20')
    await page.getByLabel('왼쪽 여백 mm').fill('24')
    await page.getByLabel('페이지 머리글').fill('프로젝트 헤더')
    await page.getByLabel('페이지 꼬리말').fill('Page {page}')
    await page.getByRole('button', { name: '적용' }).click()
    await expect(pages).toHaveAttribute('data-paper', 'grid')
    await expect(pages).toHaveAttribute('data-page-size', 'B4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'landscape')
    await expect(pages).toHaveAttribute('data-page-columns', '2')
    await expect(page.getByLabel('편집 화면 머리글 미리보기')).toHaveText('프로젝트 헤더')
    await expect(page.getByLabel('편집 화면 꼬리말 미리보기')).toHaveText('Page 1')
    await expect(page.locator('.jan-page-margin-frame')).toBeVisible()
    await expect(pageStatus).toContainText('B4')
    await expect(pageStatus).toContainText('가로')
    await expect(pageStatus).toContainText('2단')
    await expect(pageStatus).toContainText('상12 우16 하20 좌24mm')
    await expect(ruler.locator('.jan-page-ruler-margin-left')).toContainText('24mm')
    await expect(ruler.locator('.jan-page-ruler-margin-right')).toContainText('16mm')
    await expect(verticalRuler.locator('.jan-page-vertical-ruler-margin-top')).toContainText('12mm')
    await expect(verticalRuler.locator('.jan-page-vertical-ruler-margin-bottom')).toContainText('20mm')
    const columnCount = await editor.evaluate((node) => getComputedStyle(node).columnCount)
    expect(columnCount).toBe('2')
    const padding = await editor.evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        top: Math.round(parseFloat(style.paddingTop)),
        right: Math.round(parseFloat(style.paddingRight)),
        bottom: Math.round(parseFloat(style.paddingBottom)),
        left: Math.round(parseFloat(style.paddingLeft)),
      }
    })
    expect(padding).toEqual({ top: 45, right: 60, bottom: 76, left: 91 })
    const pageUi = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state)
    expect(pageUi.runningHeader).toBe('프로젝트 헤더')
    expect(pageUi.runningFooter).toBe('Page {page}')
    expect(pageUi.pageColumnCount).toBe(2)
    expect(pageUi.pageMarginsMm).toEqual({ top: 12, right: 16, bottom: 20, left: 24 })

    await page.getByRole('textbox', { name: '메모 제목' }).fill('B4 layout memo')
    await page.reload()
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-paper', 'grid')
    await expect(pages).toHaveAttribute('data-page-size', 'B4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'landscape')
    await expect(pages).toHaveAttribute('data-page-columns', '2')

    await page.getByRole('button', { name: '페이지', exact: true }).click()
    await page.locator('.jan-menu-dropdown').getByRole('button', { name: /인쇄 미리보기/ }).click()
    await expect(page.locator('.jan-print-title')).toContainText('B4 가로')
    await expect(page.locator('.jan-print-title')).toContainText('2단')
    const printSrcdoc = await page.locator('.jan-print-iframe').evaluate((iframe) => (iframe as HTMLIFrameElement).srcdoc)
    expect(printSrcdoc).toContain('@page { size: 353mm 250mm; margin: 12mm 16mm 20mm 24mm;')
    expect(printSrcdoc).toContain('data-columns="2"')
    expect(printSrcdoc).toContain('프로젝트 헤더')
    await page.locator('.jan-print-shell').getByRole('button', { name: /닫기/ }).click()

    await page.getByRole('button', { name: '+ 새 메모' }).click()
    await expect(pages).toHaveAttribute('data-paper', 'lined')
    await expect(pages).toHaveAttribute('data-page-size', 'A4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'portrait')
    await expect(pages).toHaveAttribute('data-page-columns', '1')

    await page.getByRole('listitem').filter({ hasText: 'B4 layout memo' }).click()
    await expect(pages).toHaveAttribute('data-paper', 'grid')
    await expect(pages).toHaveAttribute('data-page-size', 'B4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'landscape')
    await expect(pages).toHaveAttribute('data-page-columns', '2')
  })

  test('status bar surfaces personal storage sync failures on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem(
        'jan-v2-settings',
        JSON.stringify({ state: { syncEnabled: true, syncProvider: 'onedrive' }, version: 0 })
      )
      localStorage.setItem('jan.v2.sync.lastError', 'OneDrive token expired')
      localStorage.setItem('jan.v2.sync.lastErrorAt', String(Date.now()))
      localStorage.setItem('jan.v2.sync.lastProvider', 'onedrive')
    })
    await page.goto('./')
    const syncChip = page.locator('.jan-sync-status-chip.is-error')
    await expect(syncChip).toBeVisible({ timeout: 15000 })
    await expect(syncChip).toContainText('OneDrive')

    await syncChip.click()
    await expect(page.locator('.jan-settings-modal')).toBeVisible()
    await expect(page.locator('.jan-sync-health-alert')).toContainText('OneDrive token expired')
  })

  test('open settings refreshes personal sync health events without reopening', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem(
        'jan-v2-settings',
        JSON.stringify({ state: { syncEnabled: true, syncProvider: 'dropbox' }, version: 0 })
      )
    })
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.keyboard.press('Control+,')
    await expect(page.locator('.jan-settings-modal')).toBeVisible()
    await expect(page.locator('.jan-sync-health-alert')).toHaveCount(0)

    await page.evaluate(() => {
      localStorage.setItem('jan.v2.sync.lastError', 'Dropbox autosync failed')
      localStorage.setItem('jan.v2.sync.lastErrorAt', String(Date.now()))
      localStorage.setItem('jan.v2.sync.lastProvider', 'dropbox')
      window.dispatchEvent(new Event('jan-byoc-sync-health'))
    })

    await expect(page.locator('.jan-sync-health-alert')).toContainText('Dropbox autosync failed')
  })

  test('business card extraction from the current memo corrects draft fields before save', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type(`명함에서 읽은 정보:
이름 최민호
회사 우주주차
전화 064.756.1633
팩스 064.756.1634
이메일 cmh@woojoocha.com
주소 제주특별자치도 제주시 첨단로 245-13`)

    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-input').fill('명함')
    await page.locator('.jan-cp-item', { hasText: '명함 관리' }).click()
    const modal = page.locator('.jan-cards-modal')
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: /명함 추가/ }).click()

    const form = modal.locator('.jan-card-form')
    await form.getByLabel('이름', { exact: true }).fill('오인식')
    await form.getByLabel('전화', { exact: true }).fill('000-0000-0000')
    await modal.getByRole('button', { name: /현재 메모에서 추출/ }).click()

    await expect(form.getByLabel('이름', { exact: true })).toHaveValue('최민호')
    await expect(form.getByLabel('회사', { exact: true })).toHaveValue('우주주차')
    await expect(form.getByLabel('휴대폰', { exact: true })).toHaveValue('')
    await expect(form.getByLabel('전화', { exact: true })).toHaveValue('064.756.1633')
    await expect(form.getByLabel('팩스', { exact: true })).toHaveValue('064.756.1634')
    await expect(form.getByLabel('이메일', { exact: true })).toHaveValue('cmh@woojoocha.com')
    await expect(form.getByLabel('주소', { exact: true })).toHaveValue('제주특별자치도 제주시 첨단로 245-13')
    await expect(modal.locator('.jan-cards-inline-status')).toContainText('초안')

    await form.getByRole('button', { name: /저장/ }).click()
    await expect(modal.locator('.jan-card-profile')).toContainText('최민호')
    await expect(modal.locator('.jan-card-profile')).toContainText('우주주차')
    await expect(modal.locator('.jan-card-profile')).toContainText('064.756.1633')
  })

  test('view zoom controls support Word-style fit modes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    const zoomValue = page.locator('.jan-zoom-value')
    const readZoom = () => page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state?.zoom || 1)

    await expect(zoomValue).toHaveText('100%')
    await page.getByRole('button', { name: '보기', exact: true }).click()
    await page.getByRole('button', { name: '한 페이지 보기', exact: true }).click()
    await expect.poll(readZoom).toBeLessThan(1)
    await expect(zoomValue).not.toHaveText('100%')
    const wholePageZoom = await readZoom()

    await page.getByRole('button', { name: '보기', exact: true }).click()
    await page.getByRole('button', { name: '페이지 너비에 맞춤', exact: true }).click()
    await expect.poll(readZoom).toBeGreaterThan(wholePageZoom)
    const widthZoom = await readZoom()

    await page.getByLabel('상태바 줌 아웃').click()
    await expect.poll(readZoom).toBeLessThan(widthZoom)
    await page.getByLabel('상태바 줌 인').click()
    await expect.poll(readZoom).toBeGreaterThan(widthZoom - 0.01)

    const zoomSlider = page.getByLabel('상태바 줌 슬라이더')
    await zoomSlider.focus()
    await page.keyboard.press('Home')
    await expect.poll(readZoom).toBe(0.35)
    await expect(zoomValue).toHaveText('35%')
  })

  test('view menu can hide and restore page rulers', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    const pages = page.locator('.jan-editor-pages').first()
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-rulers', 'true')
    await expect(page.getByRole('img', { name: /가로 페이지 눈금자/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /세로 페이지 눈금자/ })).toBeVisible()

    await page.getByRole('button', { name: '보기', exact: true }).click()
    await page.getByRole('button', { name: '눈금자 숨기기' }).click()
    await expect(pages).toHaveAttribute('data-rulers', 'false')
    await expect(page.getByRole('img', { name: /가로 페이지 눈금자/ })).toHaveCount(0)
    await expect(page.getByRole('img', { name: /세로 페이지 눈금자/ })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state?.showRulers)).toBe(false)

    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-input').fill('눈금자 표시')
    await page.getByRole('button', { name: /눈금자 표시/ }).click()
    await expect(pages).toHaveAttribute('data-rulers', 'true')
    await expect(page.getByRole('img', { name: /가로 페이지 눈금자/ })).toBeVisible()
    await expect(page.getByRole('img', { name: /세로 페이지 눈금자/ })).toBeVisible()
  })

  test('view menu switches between print and draft layouts', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    const pages = page.locator('.jan-editor-pages').first()
    const pageStatus = page.getByRole('button', { name: '상태바 페이지 설정' })
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-view-layout', 'print')
    await expect(pageStatus).toContainText('인쇄')

    await page.getByRole('button', { name: '보기', exact: true }).click()
    await page.getByRole('button', { name: '초안 레이아웃', exact: true }).click()
    await expect(pages).toHaveAttribute('data-view-layout', 'draft')
    await expect(pages).toHaveAttribute('data-rulers', 'false')
    await expect(page.getByRole('img', { name: /가로 페이지 눈금자/ })).toHaveCount(0)
    await expect(pageStatus).toContainText('초안')
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-ui') || '{}')?.state?.viewLayout)).toBe('draft')

    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-input').fill('인쇄 레이아웃')
    await page.getByRole('button', { name: /인쇄 레이아웃/ }).first().click()
    await expect(pages).toHaveAttribute('data-view-layout', 'print')
    await expect(pageStatus).toContainText('인쇄')
    await expect(page.getByRole('img', { name: /가로 페이지 눈금자/ })).toBeVisible()
  })

  test('page breaks use one canonical Word-style marker', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    const breaks = editor.locator('hr.jan-page-break[data-page-break="1"]')
    await expect(editor).toBeVisible({ timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('First page')
    await page.keyboard.press('Control+Enter')
    await page.keyboard.type('Second page')
    await expect(breaks).toHaveCount(1)
    await expect(editor).toContainText('Second page')

    await page.getByRole('button', { name: '페이지', exact: true }).click()
    await page.locator('.jan-menu-dropdown').getByRole('button', { name: /페이지 구분 삽입/ }).click()
    await expect(breaks).toHaveCount(2)

    await page.keyboard.press('Control+Shift+P')
    await page.locator('.jan-cp-input').fill('페이지 구분')
    await page.getByRole('button', { name: /페이지 구분/ }).first().click()
    await expect(breaks).toHaveCount(3)
  })

  test('meeting notes flow inserts a structured v1-style note', async ({ page }) => {
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    await page.getByLabel('회의노트').click()
    await expect(page.locator('.jan-meeting-modal')).toBeVisible()
    await page.locator('.jan-meeting-capture input').first().fill('동기화 점검 회의')
    await page.locator('.jan-meeting-capture textarea').nth(1).fill('오늘 회의에서는 v2 동기화 정책을 확정했습니다.\n민수 담당으로 다음 주까지 Dropbox 백업 테스트를 진행해야 합니다.')
    await page.getByRole('button', { name: '발언 추가' }).click()
    await expect(page.locator('.jan-meeting-transcript-list article')).toHaveCount(2)
    await expect(page.locator('.jan-meeting-result')).toContainText('액션 아이템')

    await page.getByRole('button', { name: '메모에 삽입' }).click()
    await expect(page.locator('.ProseMirror').first()).toContainText('동기화 점검 회의')
    await expect(page.locator('.ProseMirror').first()).toContainText('Dropbox 백업 테스트')
  })

  test('find and replace uses Word-style document positions and whole-word matching', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Heading')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Needle catalog cat cat2 cat')

    await page.keyboard.press('Control+H')
    const findbar = page.locator('.jan-findbar')
    await expect(findbar).toBeVisible()
    const findInput = findbar.locator('input[type="text"]').nth(0)
    const replaceInput = findbar.locator('input[type="text"]').nth(1)
    const count = findbar.locator('.jan-findbar-count')

    await findInput.fill('Needle')
    await expect(count).toHaveText('1/1')
    await replaceInput.fill('Found')
    await findbar.getByRole('button', { name: '바꾸기' }).click()
    await expect(editor).toContainText('Heading')
    await expect(editor).toContainText('Found catalog cat cat2 cat')

    await findInput.fill('cat')
    await replaceInput.fill('dog')
    await findbar.locator('label', { hasText: '단어' }).locator('input').check()
    await expect(count).toHaveText('1/2')
    await findbar.getByRole('button', { name: '전체' }).click()
    await expect(editor).toContainText('Found catalog dog cat2 dog')
  })

  test('outline panel behaves like a Word navigation pane', async ({ page }) => {
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Control+Alt+1')
    await page.keyboard.type('Project Plan')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+Alt+2')
    await page.keyboard.type('Scope')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Control+Shift+N')
    await page.keyboard.type('Body text')

    await page.getByRole('button', { name: '보기', exact: true }).click()
    await page.getByRole('button', { name: /목차/ }).click()
    const outline = page.locator('.jan-outline')
    await expect(outline).toBeVisible()
    await expect(outline.locator('.jan-outline-head small')).toHaveText('2')
    await expect(outline.getByRole('button', { name: /Project Plan/ })).toBeVisible()
    await expect(outline.locator('.jan-outline-item.is-active', { hasText: 'Scope' })).toBeVisible()

    await outline.getByLabel('목차 제목 검색').fill('Scope')
    await expect(outline.getByRole('button', { name: /Scope/ })).toBeVisible()
    await expect(outline.getByRole('button', { name: /Project Plan/ })).toHaveCount(0)
  })

  test('table sorting keeps the header row and sorts data rows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem('jan-v2-ui', JSON.stringify({ state: { zoom: 1, viewLayout: 'print', showRulers: true }, version: 0 }))
    })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')

    await page.getByRole('button', { name: '삽입', exact: true }).click()
    await page.getByRole('button', { name: '표 (3×3)' }).click()

    const cells = page.locator('.ProseMirror table th, .ProseMirror table td')
    await expect(cells).toHaveCount(9)
    const values = ['Name', 'Amount', 'Note', 'Beta', '10', 'B row', 'Alpha', '2', 'A row']
    for (let i = 0; i < values.length; i += 1) {
      await page.keyboard.type(values[i])
      if (i < values.length - 1) await page.keyboard.press('Tab')
    }

    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Shift+Tab')
    await page.getByTitle('현재 열 오름차순').click()
    const rows = page.locator('.ProseMirror table tr')
    await expect(rows.nth(0)).toContainText('Name')
    await expect(rows.nth(1)).toContainText('Alpha')
    await expect(rows.nth(2)).toContainText('Beta')
  })

  test('table aggregates skip headers and the result cell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      localStorage.setItem('jan-v2-role-onboarded', '1')
      localStorage.setItem('jan-v2-ui', JSON.stringify({ state: { zoom: 1, viewLayout: 'print', showRulers: true }, version: 0 }))
    })
    await page.goto('./')
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.press('Control+A')

    await page.getByRole('button', { name: '삽입', exact: true }).click()
    await page.getByRole('button', { name: '표 (3×3)' }).click()

    const cells = page.locator('.ProseMirror table th, .ProseMirror table td')
    await expect(cells).toHaveCount(9)
    const values = ['Name', 'Amount', 'Note', 'Beta', '₩10', 'B row', 'Alpha', '2', 'A row']
    for (let i = 0; i < values.length; i += 1) {
      await page.keyboard.type(values[i])
      if (i < values.length - 1) await page.keyboard.press('Tab')
    }

    await page.getByTitle('아래 행 추가').click()
    await expect(cells).toHaveCount(12)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.getByTitle('현재 열 합계').click()
    await expect(cells.nth(10)).toContainText('합계: 12')
  })

  test('document style presets apply Word-like typography settings', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jan-v2-role-onboarded', '1'))
    await page.goto('./')
    await page.locator('.ProseMirror').first().waitFor({ state: 'visible', timeout: 15000 })

    await page.getByRole('button', { name: '서식', exact: true }).click()
    await page.getByRole('button', { name: /문서 스타일/ }).click()
    const modal = page.locator('.jan-typography-modal')
    await expect(modal).toBeVisible()

    await modal.locator('.jan-typography-preset', { hasText: '원고/논문' }).click()
    await expect(modal.locator('.jan-typography-preset.is-active', { hasText: '원고/논문' })).toBeVisible()

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jan-v2-typography') || '{}')?.state)
    expect(stored).toMatchObject({
      presetId: 'manuscript',
      fontFamily: 'serif',
      fontSize: 15,
      paragraphSpacing: 12,
    })

    const editorStyle = await page.locator('.ProseMirror').first().evaluate((node) => {
      const style = getComputedStyle(node)
      return { fontFamily: style.fontFamily, lineHeight: style.lineHeight, fontSize: style.fontSize }
    })
    expect(editorStyle.fontFamily).toContain('Noto Serif KR')
    expect(editorStyle.fontSize).toBe('15px')
  })
})
