import { expect, test } from '@playwright/test'

test('после первой загрузки приложение открывается без сети', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'service worker в WebKit-сборке Playwright под Windows не поддерживается')

  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Начать пуск' })).toBeVisible()
  // Ждём, пока service worker установится и закэширует оболочку.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    if (reg.active?.state !== 'activated') {
      await new Promise<void>((r) => reg.active?.addEventListener('statechange', () => r()))
    }
  })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Начать пуск' })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Тоны' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Тренажёр тонов' })).toBeVisible()
  // Шрифт тоже из кэша: ǚ рисуется IBM Plex Sans, а не запасным
  const fontOk = await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans"', 'ǚ'))
  expect(fontOk).toBe(true)
  await context.setOffline(false)
})
