import { expect, test } from '@playwright/test'
import { markSoundChecked, seedCompleted } from './helpers.ts'

test('первый запуск: обучение из четырёх шагов, после «Начать» не возвращается', async ({ page }) => {
  await page.goto('./')
  const dialog = page.getByRole('dialog', { name: 'Как здесь учиться' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('1 / 4')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Одно занятие в день' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Дальше' }).click()
  await expect(dialog.getByRole('heading', { name: 'Курс показывает путь' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Дальше' }).click()
  await dialog.getByRole('button', { name: 'Дальше' }).click()
  await expect(dialog.getByRole('heading', { name: 'Непонятно — нажми' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Начать' }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Начать занятие' })).toBeVisible()
  await expect(dialog).toBeHidden()
})

test('у кого уже есть прогресс — «Что изменилось», обучение по желанию; заново — из «Как устроено приложение»', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Пропустить' }).click()
  await seedCompleted(page, ['s0-u1-l1'])
  // Прогресс есть, флаг приветствия сбрасываем — так выглядит обновление у старого пользователя
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xiaohuo')
      req.onsuccess = () => {
        const tx = req.result.transaction('meta', 'readwrite')
        tx.objectStore('meta').delete('welcomeSeen')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
  await page.reload()
  const changed = page.getByRole('dialog', { name: 'Что изменилось' })
  await expect(changed).toBeVisible()
  await changed.getByRole('button', { name: 'Показать обучение' }).click()
  await expect(page.getByRole('dialog', { name: 'Как здесь учиться' })).toBeVisible()
  await page.getByRole('button', { name: 'Пропустить' }).click()

  await page.goto('./#/more')
  await page.getByRole('link', { name: /^Как устроено приложение/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Как устроено приложение' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Очки · Δv' })).toBeVisible()
  await page.getByRole('button', { name: 'Показать обучение заново' }).click()
  await expect(page.getByRole('dialog', { name: 'Как здесь учиться' })).toBeVisible()
})

test('счётчики и термины объясняются одним тапом', async ({ page }) => {
  await markSoundChecked(page)
  await page.goto('./')
  await page.getByRole('button', { name: /Дни подряд · на орбите: объяснить/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Дни подряд · на орбите' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText(/резервный день/)).toBeVisible()
  await sheet.getByRole('button', { name: 'Понятно' }).click()
  await expect(sheet).toBeHidden()

  await page.goto('./#/more')
  await page.getByRole('button', { name: /Очки · Δv: объяснить/ }).click()
  await expect(page.getByRole('dialog', { name: 'Очки · Δv' })).toBeVisible()
})
