import { expect, test } from '@playwright/test'

test('первый запуск: главный экран и кнопка занятия в зоне большого пальца', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle(/Сяо Хо/)
  const start = page.getByRole('button', { name: 'Начать занятие' })
  await expect(start).toBeVisible()
  const box = (await start.boundingBox())!
  const vh = page.viewportSize()!.height
  expect(box.y).toBeGreaterThan(vh * 0.6) // нижняя треть экрана
  expect(box.height).toBeGreaterThanOrEqual(44)
  // Где я, что будет и сколько это займёт — видно сразу
  await expect(page.getByRole('heading', { level: 1, name: 'Сегодня' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Занятие на сегодня' })).toBeVisible()
  await expect(page.getByText(/Новый урок «/)).toBeVisible()
  await expect(page.getByText(/≈ \d+ мин/)).toBeVisible()
})

test('навигация по всем разделам', async ({ page }) => {
  await page.goto('./')
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  for (const [tab, heading] of [
    ['Курс', 'Курс'],
    ['Тренировка', 'Тренировка'],
    ['Словарь', 'Словарь'],
    ['Профиль', 'Профиль'],
  ]) {
    await nav.getByRole('link', { name: tab }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  // Разделы тренировки и профиля называют, что внутри
  for (const [tab, item, heading] of [
    ['Тренировка', 'Тренажёр тонов', 'Тренажёр тонов'],
    ['Тренировка', 'Игры', 'Игры'],
    ['Тренировка', 'Эхо', 'Эхо'],
    ['Тренировка', 'Командировка', 'Командировка'],
    ['Профиль', 'Статистика', 'Статистика'],
    ['Профиль', 'Настройки', 'Настройки'],
    ['Профиль', 'О приложении', 'О приложении'],
  ]) {
    await nav.getByRole('link', { name: tab }).click()
    await page.getByRole('link', { name: new RegExp(`^${item}`) }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  // «Сегодня»: подробности занятия — отдельный экран, блоки названы простыми словами
  await nav.getByRole('link', { name: 'Сегодня' }).click()
  await page.getByRole('link', { name: 'Подробнее о занятии' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Занятие на сегодня' })).toBeVisible()
  await page.getByRole('button', { name: 'Начать: Новый урок' }).click()
  await expect(nav).toBeHidden() // урок — во весь экран
})

test('ни на одном экране нет горизонтальной прокрутки, иероглифы помечены zh-CN', async ({ page }) => {
  for (const path of ['/', '/map', '/train', '/tones', '/games', '/dictionary', '/more', '/settings', '/about']) {
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
