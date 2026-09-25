import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('тема и длительность сохраняются после перезагрузки', async ({ page }) => {
  await page.goto('./#/settings')
  await page.getByRole('radio', { name: 'Тёмная' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('radio', { name: '30 мин' }).click()
  await page.getByRole('switch', { name: /Цвета тонов/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-tone-colors', 'off')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('radio', { name: '30 мин' })).toHaveAttribute('aria-checked', 'true')
  await page.goto('./#/')
  await expect(page.getByText('Циклограмма пуска · 30 мин')).toBeVisible()
})

test('бэкап: сохранить → изменить → загрузить → всё вернулось', async ({ page }) => {
  await page.goto('./#/settings')
  await page.getByRole('radio', { name: '20 мин' }).click()
  await expect(page.getByRole('radio', { name: '20 мин' })).toHaveAttribute('aria-checked', 'true')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Сохранить бэкап' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^xiaohuo-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await download.path()
  const json = JSON.parse(await readFile(file, 'utf8'))
  expect(json).toMatchObject({ app: 'xiao-huo', format: 1 })
  await expect(page.getByText(/Последний бэкап:/)).toBeVisible()

  await page.getByRole('radio', { name: '45 мин' }).click()
  await page.getByTestId('backup-file').setInputFiles(file)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Загрузить бэкап' }).click()
  await expect(page.getByText('Готово: прогресс восстановлен из бэкапа.')).toBeVisible()
  await expect(page.getByRole('radio', { name: '20 мин' })).toHaveAttribute('aria-checked', 'true')
})

test('чужой файл вместо бэкапа — понятная ошибка, данные не тронуты', async ({ page }) => {
  await page.goto('./#/settings')
  await page.getByRole('radio', { name: '30 мин' }).click()
  await page.getByTestId('backup-file').setInputFiles({
    name: 'photo.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  })
  await expect(page.getByText(/Это не бэкап/)).toBeVisible()
  await expect(page.getByRole('radio', { name: '30 мин' })).toHaveAttribute('aria-checked', 'true')
})

test('сброс прогресса спрашивает подтверждение', async ({ page }) => {
  await page.goto('./#/settings')
  await page.getByRole('button', { name: 'Сбросить прогресс' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Стереть весь прогресс?' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Отмена' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Сбросить прогресс' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Да, стереть' }).click()
  await expect(page.getByText(/Прогресс сброшен/)).toBeVisible()
})
