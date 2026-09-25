import { expect, test } from '@playwright/test'

test('iPhone: подсказка «Установи на главный экран», закрывается и не возвращается', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'только iOS')
  await page.goto('./')
  const banner = page.getByRole('status').filter({ hasText: 'Установи на главный экран' })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: 'Закрыть' }).click()
  await expect(banner).toBeHidden()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Начать пуск' })).toBeVisible()
  await expect(banner).toBeHidden()
})
