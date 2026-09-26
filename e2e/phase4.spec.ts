import { expect, test, type Page } from '@playwright/test'
import { markSoundChecked, passLesson, seedCompleted, STAGE0_BEFORE_BOSS } from './helpers.ts'

const STAGE0_ALL = [...STAGE0_BEFORE_BOSS, 's0-u6-l1']
const STAGE1_ALL = Array.from({ length: 9 }, (_, u) => [1, 2, 3].map((l) => `s1-u${u + 1}-l${l}`).concat(`s1-u${u + 1}-boss`)).flat()

/** Подменить Web Speech API: «распознаёт» заданный текст, без сети. */
async function fakeRecognition(page: Page, heard: string[]) {
  await page.addInitScript((alts) => {
    class FakeRecognition {
      lang = ''
      interimResults = false
      maxAlternatives = 1
      continuous = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        setTimeout(() => {
          const first = Object.assign(
            alts.map((transcript) => ({ transcript })),
            { length: alts.length },
          )
          this.onresult?.({ results: Object.assign([first], { length: 1 }) })
          this.onend?.()
        }, 300)
      }
      stop() {}
      abort() {}
    }
    Object.assign(window, { webkitSpeechRecognition: FakeRecognition, SpeechRecognition: FakeRecognition })
  }, heard)
}

test('карточка слова: мнемоника, порядок черт с анимацией и «напиши сам», примеры', async ({ page }) => {
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, 's1-u1-l1'])
  await page.goto('./#/dictionary')
  await page.getByRole('link', { name: 'Подробнее: 好' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '好' })).toBeVisible()
  await expect(page.getByText('Как запомнить')).toBeVisible()
  await expect(page.getByText(/мама с ребёнком/)).toBeVisible()
  const strokes = page.getByTestId('stroke-order')
  await expect(strokes.locator('svg').first()).toBeVisible()
  await expect(strokes.getByText('черт: 6')).toBeVisible()
  await page.getByRole('button', { name: 'Показать порядок черт' }).click()
  await page.getByRole('button', { name: 'Напиши сам' }).click({ timeout: 15_000 })
  await expect(page.getByText('Веди пальцем по клетке черту за чертой.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Примеры' })).toBeVisible()
})

test('распознавание (бета): что услышано и какие иероглифы совпали', async ({ page }) => {
  await fakeRecognition(page, ['你好我叫沙沙', '你好我叫萨沙'])
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, 's1-u1-l1'])
  await page.goto('./#/echo/dialogue-d-s1-u1-boss')
  await page.getByRole('button', { name: 'Распознать (бета)' }).click()
  await expect(page.getByText(/серверы своего разработчика/)).toBeVisible()
  await expect(page.getByText(/Тоны он напрямую не проверяет/)).toBeVisible()
  await page.getByRole('button', { name: 'Понятно, распознать' }).click()
  // Первая реплика — 你好！我叫小李。: лучший вариант совпадает на 4 из 6
  await expect(page.getByText(/Совпало \d из 6 иероглифов/)).toBeVisible()
  await expect(page.getByText('Услышано:')).toBeVisible()
})

test('график тона после записи (Chromium, поддельный микрофон)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'запись проверяется в Chromium')
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, 's1-u1-l1'])
  await page.goto('./#/echo/dialogue-d-s1-u1-boss')
  await page.getByRole('button', { name: 'Записать себя' }).click()
  await page.getByRole('button', { name: 'Понятно, записать' }).click()
  await page.getByRole('button', { name: 'Стоп' }).waitFor()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Стоп' }).click()
  await page.getByRole('button', { name: 'График тона' }).click()
  const chart = page.getByTestId('pitch-chart')
  await expect(chart).toBeVisible({ timeout: 15_000 })
  await expect(chart.getByText(/наглядная подсказка, а не оценка|не слышно голоса/)).toBeVisible()
  // Линия образца нарисована
  expect(await chart.locator('path').first().getAttribute('d')).toMatch(/^M/)
})

test('карточка типа 5 — только иероглифы, без пиньиня', async ({ page }) => {
  await markSoundChecked(page)
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xiaohuo')
      req.onsuccess = () => {
        // План пуска мог собраться при первом открытии — сбрасываем, чтобы карточка в него попала.
        const tx = req.result.transaction(['cards', 'launches'], 'readwrite')
        tx.objectStore('launches').clear()
        tx.objectStore('cards').put({
          id: 'w-gongchengshi:5', itemId: 'w-gongchengshi', kind: 5, due: Date.now() - 1000,
          stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, reps: 0, lapses: 0, state: 0,
        })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
    })
  })
  await page.goto('./#/session')
  await page.getByRole('button', { name: 'Начать: Повторение' }).click()
  await page.getByRole('button', { name: 'Понятно', exact: true }).click()
  await expect(page.getByText('Прочитай и вспомни значение')).toBeVisible()
  await expect(page.getByText('工程师', { exact: true })).toBeVisible()
  await expect(page.locator('[lang="zh-Latn-pinyin"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Проверить себя' }).click()
  await expect(page.getByText('инженер', { exact: true })).toBeVisible()
  await expect(page.locator('[lang="zh-Latn-pinyin"]').first()).toBeVisible()
})

test('ступень 2: этап «Инженер» проходится, словарь фильтрует модуль «Инженер»', async ({ page }) => {
  test.setTimeout(240_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, ...STAGE1_ALL])
  await page.goto('./#/map')
  await expect(page.getByRole('button', { name: /2\.4 Инженер: завод и чертёж/ })).toBeVisible({ timeout: 20_000 })
  await page.goto('./#/lesson/s2-u4-l1')
  await expect(page.getByRole('heading', { name: 'Новые слова' })).toBeVisible()
  await passLesson(page, 120)
  await expect(page.getByRole('heading', { name: 'Урок пройден' })).toBeVisible()
  await page.goto('./#/dictionary')
  await page.getByRole('radio', { name: 'Инженер' }).click()
  await expect(page.getByText('цех', { exact: true })).toBeVisible()
  await expect(page.getByText('старший брат')).toHaveCount(0)
})
