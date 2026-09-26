import { expect, test } from '@playwright/test'
import { markSoundChecked, passLesson, seedCompleted, STAGE0_BEFORE_BOSS } from './helpers.ts'

const STAGE0_ALL = [...STAGE0_BEFORE_BOSS, 's0-u6-l1']
const UNIT1 = ['s1-u1-l1', 's1-u1-l2', 's1-u1-l3']

test('босс этапа 1.1 — диалог: верные ответы → «Пуск!», этап закрыт', async ({ page }) => {
  test.setTimeout(180_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, ...UNIT1])
  await page.goto('./#/lesson/s1-u1-boss')
  // Реплика персонажа — его голосом, с подписью, кто говорит
  await page.getByRole('button', { name: 'Дальше', exact: true }).click() // вступление к диалогу
  await expect(page.getByText('小李', { exact: true }).first()).toBeVisible()
  await passLesson(page, 60, 'right')
  await expect(page.getByRole('heading', { name: 'Пуск!' })).toBeVisible()
  await expect(page.getByText(/Этап 1\.1 «Знакомство» закрыт/)).toBeVisible()
  await expect(page.getByText('Ответы в диалоге')).toBeVisible()
  // На карте этапа босс отмечен пройденным
  await page.goto('./#/unit/s1-u1')
  await expect(page.getByText('Знакомство на заводе')).toBeVisible()
})

test('босс этапа 1.1 — неверные ответы: «Пуск перенесён» и путь в «Эхо»', async ({ page }) => {
  test.setTimeout(180_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, ...UNIT1])
  await page.goto('./#/lesson/s1-u1-boss')
  await passLesson(page, 60, 'wrong')
  await expect(page.getByRole('heading', { name: 'Пуск перенесён' })).toBeVisible()
  await expect(page.getByText(/нужно 80% верных ответов/)).toBeVisible()
  await page.getByRole('button', { name: 'Послушать диалог в «Эхо»' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Знакомство на заводе' })).toBeVisible()
})

test('«Командировка»: эпизод 1 открыт после этапа 1.1 и проходится до конца', async ({ page }) => {
  test.setTimeout(180_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, ...UNIT1])
  await page.goto('./#/story')
  await expect(page.getByRole('heading', { name: 'Прилёт' })).toBeVisible()
  await expect(page.getByText('Персонажи')).toBeVisible()
  await expect(page.getByText('王工', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Смотреть' }).first().click()
  await passLesson(page, 80)
  await expect(page.getByRole('heading', { name: 'Урок пройден' })).toBeVisible()
  await page.getByRole('button', { name: 'К сюжету' }).click()
  await expect(page.getByText('✓ пройден')).toBeVisible()
})

test('«Эхо»: дорожка, автопауза, скорость, переключатели, запись и сравнение', async ({ page, browserName }) => {
  test.setTimeout(120_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, 's1-u1-l1'])
  await page.goto('./#/echo')
  await expect(page.getByRole('heading', { name: 'Пройденное' })).toBeVisible()
  await page.getByRole('button', { name: /Знакомство на заводе/ }).click()
  await expect(page.getByText('1 из 8')).toBeVisible()

  // Воспроизведение: фраза → «твоя очередь» → следующая
  await page.getByRole('radio', { name: '0.75×' }).click()
  await page.getByTestId('echo-play').click()
  await expect(page.getByText('Твоя очередь — повтори вслух')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-current]')).toContainText('萨沙', { timeout: 20_000 })
  await page.getByRole('button', { name: 'Пауза' }).click()
  await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()

  // Переключатели: без пиньиня, без перевода; «только звук» прячет текст
  const pinyin = page.locator('[data-current] [lang="zh-Latn-pinyin"]')
  await expect(pinyin.first()).toBeVisible()
  await page.getByRole('button', { name: 'пиньинь', exact: true }).click()
  await expect(pinyin).toHaveCount(0)
  await page.getByRole('button', { name: 'Только звук' }).click()
  await expect(page.locator('ol [data-current]')).toHaveCount(0)
  await expect(page.getByText('Текст спрятан — только слух и твой голос.')).toBeVisible()
  await page.getByRole('button', { name: 'Только звук' }).click()
  await page.getByRole('button', { name: 'пиньинь', exact: true }).click()

  // Запись: в Chromium — поддельный микрофон; WebKit в Playwright микрофона не даёт.
  test.skip(browserName !== 'chromium', 'запись проверяется в Chromium; на iPhone — вручную')
  await page.getByRole('button', { name: 'Записать себя' }).click()
  await expect(page.getByText(/Запись остаётся только на этом устройстве/)).toBeVisible()
  await page.getByRole('button', { name: 'Понятно, записать' }).click()
  await page.getByRole('button', { name: 'Стоп' }).waitFor()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Стоп' }).click()
  // Сравнение: образец → я → образец
  await expect(page.getByText('образец').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Записать заново' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сравнить' })).toBeEnabled({ timeout: 20_000 })
  await expect(page.getByText(/не получилось|не дал доступ/i)).toHaveCount(0)
})

test('запись в «Повтори вслух» появляется после образца', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'запись проверяется в Chromium')
  test.setTimeout(120_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL])
  await page.goto('./#/lesson/s1-u1-l1')
  const good = page.getByRole('button', { name: 'Получилось', exact: true })
  const next = page.getByRole('button', { name: 'Дальше', exact: true })
  const option = page.locator('button[class*="meaningBtn"]:not([disabled]), button[class*="choice"]:not([disabled])').first()
  for (let i = 0; i < 40 && !(await good.isVisible()); i++) {
    if (await option.isVisible()) {
      await option.click()
      await next.click()
    } else if (await next.isVisible()) await next.click()
    else await page.waitForTimeout(500)
  }
  await expect(good).toBeVisible()
  await expect(page.getByRole('button', { name: 'Записать себя' })).toBeVisible()
})
