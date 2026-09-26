import { expect, test } from '@playwright/test'

test('первый запуск: главный экран и кнопка пуска в зоне большого пальца', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle(/Сяо Хо/)
  const start = page.getByRole('button', { name: 'Начать пуск' })
  await expect(start).toBeVisible()
  const box = (await start.boundingBox())!
  const vh = page.viewportSize()!.height
  expect(box.y).toBeGreaterThan(vh * 0.6) // нижняя треть экрана
  expect(box.height).toBeGreaterThanOrEqual(44)
  await expect(page.getByText('Циклограмма пуска · 40 мин')).toBeVisible()
})

test('навигация по всем разделам', async ({ page }) => {
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  for (const [tab, heading] of [
    ['Карта', 'Карта полёта'],
    ['Тоны', 'Тренажёр тонов'],
    ['Словарь', 'Словарь'],
    ['Ещё', 'Ещё'],
  ]) {
    await nav.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  for (const [item, heading] of [
    ['Статистика', 'Статистика'],
    ['Эхо', 'Эхо'],
    ['Командировка', 'Командировка'],
    ['Настройки', 'Настройки'],
    ['О приложении', 'О приложении'],
  ]) {
    await nav.getByRole('link', { name: 'Ещё' }).click()
    await page.getByRole('link', { name: new RegExp(`^${item}`) }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  await nav.getByRole('link', { name: 'Пуск' }).click()
  await page.getByRole('button', { name: 'Начать пуск' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Пуск' })).toBeVisible()
  await page.getByRole('button', { name: 'Начать: Новое' }).click()
  await expect(nav).toBeHidden() // урок — во весь экран
})

test('ни на одном экране нет горизонтальной прокрутки, иероглифы помечены zh-CN', async ({ page }) => {
  for (const path of ['/', '/map', '/tones', '/dictionary', '/more', '/settings', '/about']) {
    await page.goto(`./#${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
  await page.goto('./#/tones')
  const hanzi = page.getByText('妈', { exact: true }).first()
  await expect(hanzi).toHaveAttribute('lang', 'zh-CN')
})

test('цели касания в навигации не меньше 44×44', async ({ page }) => {
  await page.goto('./')
  for (const link of await page.getByRole('navigation').getByRole('link').all()) {
    const b = (await link.boundingBox())!
    expect(b.width).toBeGreaterThanOrEqual(44)
    expect(b.height).toBeGreaterThanOrEqual(44)
  }
})
