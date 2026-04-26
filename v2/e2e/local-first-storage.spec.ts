import { expect, test, type Page } from '@playwright/test'

const DB_NAME = 'jan-v2-local-first'
const STORE_NAME = 'kv'
const MEMOS_KEY = 'jan:v2:memos'

async function readPersistedValue(page: Page, key: string): Promise<string | null> {
  return page.evaluate(
    async ({ dbName, storeName, storageKey }) =>
      new Promise<string | null>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1)

        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
        }

        request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(storeName, 'readonly')
          const getRequest = tx.objectStore(storeName).get(storageKey)
          getRequest.onerror = () => reject(getRequest.error || tx.error || new Error('IndexedDB read failed'))
          getRequest.onsuccess = () => {
            const value = getRequest.result
            resolve(typeof value === 'string' ? value : null)
            db.close()
          }
        }
      }),
    { dbName: DB_NAME, storeName: STORE_NAME, storageKey: key }
  )
}

test.describe('local-first memo storage', () => {
  test('persists memo content in IndexedDB without keeping a localStorage duplicate', async ({ page }) => {
    await page.goto('/')

    const marker = `Local-first E2E ${Date.now()}`
    const editor = page.locator('.ProseMirror').first()
    await editor.waitFor({ state: 'visible', timeout: 15000 })
    await editor.click()
    await page.keyboard.type(marker)

    await expect(editor).toContainText(marker)
    await expect.poll(() => readPersistedValue(page, MEMOS_KEY), { timeout: 10000 }).toContain(marker)
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), MEMOS_KEY)).toBeNull()
  })

  test('migrates existing localStorage memo data into IndexedDB on first load', async ({ page }) => {
    const now = Date.now()
    const memoId = `legacy_${now}`
    const legacyText = `Migrated localStorage memo ${now}`
    const legacyPayload = {
      state: {
        memos: {
          [memoId]: {
            id: memoId,
            title: 'Legacy memo',
            content: `<p>${legacyText}</p>`,
            createdAt: now,
            updatedAt: now,
          },
        },
        trashed: {},
        currentId: memoId,
        order: [memoId],
        sortMode: 'recent',
      },
      version: 2,
    }

    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value))
      },
      { key: MEMOS_KEY, value: legacyPayload }
    )

    await page.goto('/')

    const editor = page.locator('.ProseMirror').first()
    await expect(editor).toContainText(legacyText, { timeout: 15000 })
    await expect.poll(() => readPersistedValue(page, MEMOS_KEY), { timeout: 10000 }).toContain(legacyText)
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), MEMOS_KEY)).toBeNull()
  })
})
