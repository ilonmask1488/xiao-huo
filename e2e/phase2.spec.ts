import { expect, test } from '@playwright/test'
import { markSoundChecked, passLesson, seedCompleted, STAGE0_BEFORE_BOSS } from './helpers.ts'

const STAGE0_ALL = [...STAGE0_BEFORE_BOSS, 's0-u6-l1']

test('урок ступени 1: слова, «угадай значение», фразы, «сборка», «скажи сам» — до итогов', async ({ page }) => {
  test.setTimeout(240_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, 's1-u1-l1'])
  await page.goto('./#/lesson/s1-u1-l2')
  await expect(page.getByRole('heading', { name: 'Ещё слова' })).toBeVisible()
  const stats = await passLesson(page, 120)
  expect(stats).toMatch(/Точность/)
  // Слова урока ушли в повторение
  await page.goto('./#/stats')
  await expect(page.getByText('Карточек в повторении')).toBeVisible()
})

test('пуск: сегменты по ≤3 минуты, повторение карточек с оценками FSRS', async ({ page }) => {
  test.setTimeout(240_000)
  await markSoundChecked(page)
  await seedCompleted(page, STAGE0_ALL)
  await page.reload() // при запуске у слов пройденных уроков появляются карточки
  await page.goto('./#/session')
  await expect(page.getByRole('heading', { level: 1, name: 'Пуск' })).toBeVisible()
  // Первым — разминка-игра, дальше куски повторения не длиннее 3 минут
  const minutes = await page.locator('[class*="min"]').allTextContents()
  expect(minutes.length).toBeGreaterThan(3)
  await expect(page.getByText(/Повторение/).first()).toBeVisible()
  // Открываем первый кусок повторения
  await page.getByRole('button', { name: 'Открыть' }).first().click()
  const show = page.getByRole('button', { name: 'Показать ответ' })
  const toneChoice = page.locator('button[class*="choice"]:not([disabled])').first()
  if (await toneChoice.isVisible()) {
    await toneChoice.click()
    await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  }
  await expect(show).toBeVisible()
  await show.click()
  // Четыре оценки с интервалами
  for (const g of ['Снова', 'Трудно', 'Хорошо', 'Легко']) await expect(page.getByRole('button', { name: new RegExp(`^${g}`) })).toBeVisible()
  await page.getByRole('button', { name: /^Хорошо/ }).click()
  await expect(page.getByText(/2 из \d+/)).toBeVisible()
})

test('«Скорострел» и «Сборка»: короткие раунды до итогов', async ({ page }) => {
  test.setTimeout(120_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, 's1-u1-l1', 's1-u1-l2', 's1-u1-l3'])
  await page.goto('./#/game/speed?seconds=6')
  await page.getByRole('button', { name: 'Старт' }).click()
  for (let i = 0; i < 3; i++) {
    const o = page.locator('button[class*="option"]:not([disabled])').first()
    if (await o.isVisible()) await o.click({ timeout: 1500 }).catch(() => {})
    await page.waitForTimeout(900)
  }
  await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible({ timeout: 15_000 })

  await page.goto('./#/game/assemble?seconds=20')
  await page.getByRole('button', { name: 'Старт' }).click()
  const chip = page.locator('[class*="assemblePool"] button').first()
  await chip.waitFor()
  for (let i = 0; i < 10 && (await chip.isVisible()); i++) await chip.click({ timeout: 2000 })
  await expect(page.getByRole('button', { name: 'Сказал — дальше' })).toBeVisible()
  await page.getByRole('button', { name: 'Сказал — дальше' }).click()
  await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible({ timeout: 25_000 })
})

test('«Потренироваться с Claude» собирает промпт', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, 's1-u1-l1'])
  await page.goto('./#/unit/s1-u1')
  await expect(page.getByRole('heading', { name: '1.1 Знакомство' })).toBeVisible()
  await page.getByRole('button', { name: 'Потренироваться с Claude' }).click()
  await expect(page.getByText(/Промпт скопирован|Скопировать не получилось/)).toBeVisible()
  if (browserName === 'chromium') {
    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text).toContain('Сейчас я на этапе «1.1 Знакомство», ступень 1')
    expect(text).toContain('你好 (nǐ hǎo)')
  }
})

test('статистика: график минут, прогноз до HSK, достижения', async ({ page }) => {
  await markSoundChecked(page)
  await page.goto('./#/stats')
  await expect(page.getByRole('img', { name: /Минуты занятий по дням/ })).toBeVisible()
  await expect(page.getByText(/Прогноз до HSK/)).toBeVisible()
  await expect(page.getByText('Сотня слов')).toBeVisible()
})
