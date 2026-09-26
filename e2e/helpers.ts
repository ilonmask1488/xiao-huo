import { expect, type Page } from '@playwright/test'

/** Пропустить проверку звука перед первым уроком (она проверяется отдельно). */
export async function markSoundChecked(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xiaohuo')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('meta', 'readwrite')
        tx.objectStore('meta').put({ key: 'soundChecked', value: true })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
}

const SUMMARY = /^(Урок пройден|Раунд окончен)$/

/** Текущий номер экрана («5 из 28») или «итоги». */
async function position(page: Page): Promise<string> {
  if (await page.getByRole('heading', { name: SUMMARY }).isVisible()) return 'summary'
  const count = page.locator('[class*="count"]').first()
  if ((await count.count()) === 0) return ''
  return (await count.textContent({ timeout: 1000 }).catch(() => '')) ?? ''
}

/** Выполнить действие и дождаться смены экрана (ответ сначала пишется в базу). */
async function advance(page: Page, before: string, act: () => Promise<void>): Promise<void> {
  await act()
  await expect.poll(() => position(page), { timeout: 10_000 }).not.toBe(before)
}

/** Листать экраны («Дальше», «Получилось»), пока не появится нужный текст. */
export async function advanceUntil(page: Page, text: string, maxSteps = 40): Promise<void> {
  const good = page.getByRole('button', { name: 'Получилось', exact: true })
  const next = page.getByRole('button', { name: 'Дальше', exact: true })
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByText(text, { exact: true }).isVisible()) return
    const pos = await position(page)
    if (await good.isVisible()) await advance(page, pos, () => good.click())
    else if (await next.isVisible()) await advance(page, pos, () => next.click())
    else await good.waitFor({ timeout: 10_000 })
  }
  await expect(page.getByText(text, { exact: true })).toBeVisible()
}

/**
  Пройти открытый урок до итогов: на вопросах выбирается первый вариант,
  на самооценке — «Получилось». Возвращает текст итогов.
*/
export async function passLesson(page: Page, maxSteps = 80): Promise<string> {
  const good = page.getByRole('button', { name: 'Получилось', exact: true })
  const check = page.getByRole('button', { name: 'Проверить', exact: true })
  const next = page.getByRole('button', { name: 'Дальше', exact: true })
  const choice = page.locator('button[class*="choice"]:not([disabled])').first()
  for (let i = 0; i < maxSteps; i++) {
    const pos = await position(page)
    if (pos === 'summary') break
    if (await check.isVisible()) {
      await check.click()
      await good.waitFor()
    }
    if (await good.isVisible()) {
      await advance(page, pos, () => good.click())
    } else if (await choice.isVisible()) {
      await choice.click()
      await advance(page, pos, () => next.click())
    } else if (await next.isVisible()) {
      await advance(page, pos, () => next.click())
    } else {
      // «Повтори вслух» ещё проигрывает образец и паузу — ждём самооценку.
      await good.waitFor({ timeout: 10_000 })
    }
  }
  await expect(page.getByRole('heading', { name: SUMMARY })).toBeVisible()
  return (await page.locator('[class*="stats"]').textContent()) ?? ''
}
