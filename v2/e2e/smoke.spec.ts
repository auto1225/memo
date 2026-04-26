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
    await page.goto('./')
    const pages = page.locator('.jan-editor-pages').first()
    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toBeVisible({ timeout: 15000 })
    await expect(pages).toHaveAttribute('data-paper', 'lined')
    await expect(pages).toHaveAttribute('data-page-size', 'A4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'portrait')

    const backgroundImage = await editor.evaluate((node) => getComputedStyle(node).backgroundImage)
    expect(backgroundImage).toContain('repeating-linear-gradient')

    await page.getByRole('button', { name: '설정' }).click()
    await expect(page.locator('.jan-settings-modal')).toBeVisible()
    await page.getByRole('button', { name: '페이지 설정 열기' }).click()
    await expect(page.locator('.jan-page-settings-modal')).toBeVisible()
    await expect(page.locator('.jan-page-size-card', { hasText: 'A3' })).toBeVisible()
    await expect(page.locator('.jan-page-size-card', { hasText: 'B4' })).toBeVisible()
    await expect(page.locator('.jan-paper-style-card', { hasText: '줄노트' })).toBeVisible()

    await page.locator('.jan-page-size-card', { hasText: 'B4' }).click()
    await page.getByRole('button', { name: '가로' }).click()
    await page.locator('.jan-paper-style-card', { hasText: '모눈종이' }).click()
    await page.getByRole('button', { name: '적용' }).click()
    await expect(pages).toHaveAttribute('data-paper', 'grid')
    await expect(pages).toHaveAttribute('data-page-size', 'B4')
    await expect(pages).toHaveAttribute('data-page-orientation', 'landscape')
  })
})
