import { expect, test } from '@playwright/test'
import { advanceUntil, markSoundChecked, passLesson } from './helpers.ts'

test('проверка звука перед первым уроком: звук реально запускается', async ({ page }) => {
  await page.goto('./#/lesson/s0-u1-l1')
  await expect(page.getByRole('heading', { name: 'Проверка звука' })).toBeVisible()
  await page.getByRole('button', { name: 'Послушать mā má mǎ mà' }).click()
  // play() не отклонён браузером: плеер дошёл до «playing» (или сразу доиграл)
  await expect(page.locator('html')).toHaveAttribute('data-audio', /playing|ended/, { timeout: 8000 })
  await page.getByRole('button', { name: 'Слышу', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Один слог — пять слов' })).toBeVisible()
})

test('первый урок от начала до итогов; карта и пуск показывают прогресс', async ({ page }) => {
  test.setTimeout(180_000)
  await markSoundChecked(page)
  await page.goto('./')
  // «Начать занятие» ведёт сразу в первый блок — для новичка это новый урок
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await expect(page.getByRole('heading', { name: 'Один слог — пять слов' })).toBeVisible()

  const stats = await passLesson(page)
  expect(stats).toMatch(/Точность/)
  await expect(page.getByText('Зажигание')).toBeVisible()

  await page.getByRole('button', { name: 'Дальше по занятию' }).click()
  // После первого урока открылись разминка и эхо
  await expect(page.getByRole('button', { name: /^(Начать|Продолжить): Разминка: игра на тоны$/ })).toBeVisible()

  await page.goto('./#/map')
  await expect(page.getByText('1 из 3 уроков').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Пройти заново' })).toBeVisible()
})

test('урок можно прервать и продолжить с того же экрана', async ({ page }) => {
  await markSoundChecked(page)
  await page.goto('./#/lesson/s0-u1-l1')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await expect(page.getByText('3 из 28')).toBeVisible()
  await page.getByRole('button', { name: 'Выйти из урока' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Курс' })).toBeVisible()
  await page.goto('./#/lesson/s0-u1-l1')
  await expect(page.getByText('3 из 28')).toBeVisible()
  await expect(page.locator('[data-start-at]')).toHaveAttribute('data-start-at', '2')
  await expect(page.getByText('Продолжим с места, где остановился?')).toBeVisible()
  await page.getByRole('button', { name: 'Начать сначала' }).click()
  await expect(page.getByText('1 из 28')).toBeVisible()
})

test('ошибка в «Угадай тон»: показывает оба варианта для сравнения', async ({ page }) => {
  test.setTimeout(120_000)
  await markSoundChecked(page)
  await page.goto('./#/lesson/s0-u1-l1')
  await advanceUntil(page, 'Какой тон?')
  // Первый вопрос — ma1 (1-й тон): отвечаем «4-й»
  await page.getByRole('button', { name: '4-й тон' }).click()
  await expect(page.getByText('Ты выбрал 4-й, а это был 1-й.')).toBeVisible()
  await expect(page.getByText('Послушай оба:')).toBeVisible()
})

test('словарь наполняется словами после урока с первыми словами', async ({ page }) => {
  test.setTimeout(240_000)
  await markSoundChecked(page)
  await page.goto('./#/dictionary')
  await expect(page.getByRole('button', { name: 'К первому уроку' })).toBeVisible()
  await page.goto('./#/lesson/s0-u1-l3')
  await passLesson(page)
  await page.goto('./#/dictionary')
  await expect(page.getByText('你好', { exact: true })).toBeVisible()
  await expect(page.getByText('níhǎo', { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill('xiexie')
  await expect(page.getByText('谢谢', { exact: true })).toBeVisible()
  await expect(page.getByText('你好', { exact: true })).toBeHidden()
  await page.getByRole('searchbox').fill('до свид')
  await expect(page.getByText('再见', { exact: true })).toBeVisible()
})

test('офлайн: звук урока играет из кэша', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'service worker в WebKit-сборке Playwright под Windows не поддерживается')
  await markSoundChecked(page)
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    if (reg.active?.state !== 'activated') {
      await new Promise<void>((r) => reg.active?.addEventListener('statechange', () => r()))
    }
  })
  await page.reload() // страница под контролем service worker
  await page.goto('./#/lesson/s0-u1-l1')
  await expect(page.getByRole('heading', { name: 'Один слог — пять слов' })).toBeVisible()
  // Предзагрузка первых экранов → звук в кэше
  await page.waitForTimeout(1500)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Послушать mǎ' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-audio', /playing|ended/, { timeout: 8000 })
  await context.setOffline(false)
})
