import { expect, test, type Page } from '@playwright/test'
import { markSoundChecked, passLesson, seedCompleted, STAGE0_BEFORE_BOSS } from './helpers.ts'

/*
  UX §8.5: у каждого экрана упражнения есть инструкция (что делать), строка шагов и кнопка «?».
  Проходим уроки, где встречаются все типы упражнений, и на каждом экране проверяем шапку.
*/
const STAGE0_ALL = [...STAGE0_BEFORE_BOSS, 's0-u6-l1']

/** Все инструкции упражнений — каждая должна встретиться хотя бы раз. */
const EXPECTED = [
  'Послушай серию',
  'Повтори вслух',
  'Прочитай вслух',
  'Какой тон прозвучал? Выбери',
  'Какой слог прозвучал? Выбери',
  'Какие тоны в слове? Выбери пару',
  'Послушай и выбери, что это значит',
  'Прочитай и выбери, что это значит',
  'Разбери фразу по словам',
  'Собери фразу из слов',
  'Скажи по-китайски',
  'Слушай собеседника',
  'Выбери свой ответ и скажи его вслух',
]

async function checkHead(page: Page, seen: Set<string>) {
  // Экран объяснения — не упражнение: у него заголовок h1 и нет шапки
  if (await page.locator('h1').first().isVisible()) return
  const head = page.locator('[class*="cardHead"]')
  await expect(head, 'шапка упражнения').toBeVisible()
  const kicker = (await head.locator('[class*="kicker"]').textContent())?.trim() ?? ''
  expect(kicker.length, 'инструкция не пустая').toBeGreaterThan(3)
  await expect(head.locator('[class*="stepsLine"]'), `шаги у «${kicker}»`).toBeVisible()
  await expect(head.getByRole('button', { name: 'Как работает это упражнение' }), `«?» у «${kicker}»`).toBeVisible()
  seen.add(kicker)
}

test('у каждого экрана упражнения есть инструкция, шаги и кнопка «?»', async ({ page }) => {
  test.setTimeout(540_000)
  await markSoundChecked(page)
  const seen = new Set<string>()
  const hooks = { onScreen: () => checkHead(page, seen) }

  // Ступень 0: серия, повтори, прочитай, тон, слог, пара тонов
  for (const id of ['s0-u1-l1', 's0-u2-l1', 's0-u4-l1']) {
    await page.goto(`./#/lesson/${id}`)
    await passLesson(page, 80, 'right', hooks)
  }
  // Ступень 1: значение, фраза, сборка, скажи сам, диалог
  await seedCompleted(page, STAGE0_ALL)
  for (const id of ['s1-u1-l1', 's1-u1-l2', 's1-u1-boss']) {
    await page.goto(`./#/lesson/${id}`)
    await passLesson(page, 80, 'right', hooks)
  }
  // Карточки повторения: у первой — объяснение, дальше — инструкция по типу и «?»
  await page.reload()
  await page.goto('./#/session')
  await page.getByRole('button', { name: 'Открыть' }).first().click()
  await page.getByRole('button', { name: 'Понятно', exact: true }).click()
  const head = page.locator('[class*="cardHead"]')
  await expect(head.locator('[class*="kicker"]')).toBeVisible()
  await expect(head.locator('[class*="stepsLine"]')).toBeVisible()
  await head.getByRole('button', { name: 'Как работает это упражнение' }).click()
  await expect(page.getByRole('dialog', { name: 'Как работает повторение' })).toBeVisible()

  const missing = EXPECTED.filter((t) => !seen.has(t))
  expect(missing, 'не встретились инструкции').toEqual([])
})

test('«?» открывает объяснение упражнения, тап по слову — перевод', async ({ page }) => {
  test.setTimeout(120_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, 's1-u1-l1', 's1-u1-l2'])
  await page.goto('./#/lesson/s1-u1-l3')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await page.getByRole('button', { name: 'Понятно', exact: true }).click() // первая встреча с «Разбери фразу»
  await page.getByRole('button', { name: 'Как работает это упражнение' }).click()
  const help = page.getByRole('dialog', { name: 'Разбери фразу по словам' })
  await expect(help).toBeVisible()
  await expect(help.getByText(/Нажми на любое слово/)).toBeVisible()
  await help.getByRole('button', { name: 'Понятно' }).click()
  await page.locator('button[class*="tokenBtn"]').first().click()
  const sheet = page.getByTestId('word-sheet')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('link', { name: /Подробнее о слове/ })).toBeVisible()
  await page.getByRole('dialog', { name: 'Слово' }).getByRole('button', { name: 'Закрыть' }).click()
  await expect(sheet).toBeHidden()
})
