import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

/** Пропустить проверку звука перед первым уроком (она проверяется отдельно). */
export async function markSoundChecked(page: Page): Promise<void> {
  await page.goto('./')
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xiaohuo')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('meta', 'readwrite')
        tx.objectStore('meta').put({ key: 'soundChecked', value: true })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
}

/** Отметить уроки пройденными напрямую в базе — чтобы тест не проходил их заново. */
export async function seedCompleted(page: Page, lessonIds: string[]): Promise<void> {
  await page.evaluate(async (ids) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('xiaohuo')
      req.onsuccess = () => {
        const tx = req.result.transaction('lessonProgress', 'readwrite')
        const now = Date.now()
        for (const lessonId of ids)
          tx.objectStore('lessonProgress').put({
            lessonId,
            step: 0,
            results: {},
            startedAt: now,
            updatedAt: now,
            seconds: 60,
            completedAt: now,
            timesCompleted: 1,
            bestAccuracy: 1,
          })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, lessonIds)
}

export const STAGE0_BEFORE_BOSS = [
  's0-u1-l1', 's0-u1-l2', 's0-u1-l3',
  's0-u2-l1', 's0-u2-l2', 's0-u2-l3',
  's0-u3-l1', 's0-u3-l2', 's0-u3-l3',
  's0-u4-l1', 's0-u4-l2',
  's0-u5-l1', 's0-u5-l2',
]

const SUMMARY = /^(Урок пройден|Раунд окончен|Пуск!|Пуск перенесён)$/

type DialogueJson = { id: string; lines: { sentenceId: string; choices?: string[] }[] }
const dialogues = ['src/content/stage1/dialogues.json', 'src/content/story/dialogues.json'].flatMap(
  (f) => JSON.parse(readFileSync(f, 'utf8')) as DialogueJson[],
)
/** Верный ответ реплики: «диалог:номер» → id фразы. */
const rightReply = (dialogue: string, line: number) => dialogues.find((d) => d.id === dialogue)?.lines[line]?.sentenceId

/** Текущий номер экрана («5 из 28») или «итоги». */
async function position(page: Page): Promise<string> {
  if (await page.getByRole('heading', { name: SUMMARY }).isVisible()) return 'summary'
  const count = page.locator('[class*="count"]').first()
  if ((await count.count()) === 0) return ''
  return (await count.textContent({ timeout: 1000 }).catch(() => '')) ?? ''
}

/** Выполнить действие и дождаться смены экрана (ответ сначала пишется в базу). */
async function advance(page: Page, before: string, act: () => Promise<void>): Promise<void> {
  await act()
  await expect.poll(() => position(page), { timeout: 10_000 }).not.toBe(before)
}

/** Листать экраны («Дальше», «Получилось»), пока не появится нужный текст. */
export async function advanceUntil(page: Page, text: string, maxSteps = 40): Promise<void> {
  const good = page.getByRole('button', { name: 'Получилось', exact: true })
  const next = page.getByRole('button', { name: 'Дальше', exact: true })
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByText(text, { exact: true }).isVisible()) return
    const pos = await position(page)
    const reply = page.locator('button[data-sentence]').first()
    if (await good.isVisible()) await advance(page, pos, () => good.click())
    else if (await next.isVisible()) await advance(page, pos, () => next.click())
    else if (await reply.isVisible()) {
      await reply.click()
      await advance(page, pos, () => page.getByRole('button', { name: 'Сказал — дальше', exact: true }).click())
    }
    else await good.waitFor({ timeout: 10_000 })
  }
  await expect(page.getByText(text, { exact: true })).toBeVisible()
}

/**
  Пройти открытый урок до итогов: на вопросах выбирается первый вариант,
  на самооценке — «Получилось». Возвращает текст итогов.
*/
export async function passLesson(page: Page, maxSteps = 80, replies: 'right' | 'wrong' = 'right'): Promise<string> {
  const good = page.getByRole('button', { name: 'Получилось', exact: true })
  const check = page.getByRole('button', { name: 'Проверить', exact: true })
  const next = page.getByRole('button', { name: 'Дальше', exact: true })
  const said = page.getByRole('button', { name: 'Сказал — дальше', exact: true })
  const show = page.getByRole('button', { name: 'Показать ответ', exact: true })
  const gradeGood = page.getByRole('button', { name: /^Хорошо/ })
  const choice = page.locator('button[class*="choice"]:not([disabled])').first()
  const meaning = page.locator('button[class*="meaningBtn"]:not([disabled])').first()
  const poolChip = page.locator('[class*="pool"] button[class*="chipWord"]').first()
  const reply = page.locator('button[data-sentence]').first()
  for (let i = 0; i < maxSteps; i++) {
    const pos = await position(page)
    if (pos === 'summary') break
    if (await check.isVisible()) {
      await check.click()
      await good.waitFor()
    }
    if (await show.isVisible()) {
      await show.click()
      await advance(page, pos, () => gradeGood.click())
    } else if (await good.isVisible()) {
      await advance(page, pos, () => good.click())
    } else if (await poolChip.isVisible()) {
      // «Сборка»: переносим слова по одному, пока не кончатся, потом «Сказал — дальше»
      while (await poolChip.isVisible()) await poolChip.click()
      await advance(page, pos, () => said.click())
    } else if (await said.isVisible()) {
      await advance(page, pos, () => said.click())
    } else if (await reply.isVisible()) {
      // Диалог: выбрать верную (или нарочно неверную) реплику, потом «Сказал — дальше»
      const box = page.locator('[data-dialogue]')
      const right = rightReply((await box.getAttribute('data-dialogue')) ?? '', Number(await box.getAttribute('data-line')))
      const ids = await page.locator('button[data-sentence]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sentence') ?? ''))
      const pick = ids.find((id) => (id === right) === (replies === 'right'))!
      await page.locator(`button[data-sentence="${pick}"]`).click()
      await advance(page, pos, () => said.click())
    } else if (await meaning.isVisible()) {
      await meaning.click()
      await advance(page, pos, () => next.click())
    } else if (await choice.isVisible()) {
      await choice.click()
      await advance(page, pos, () => next.click())
    } else if (await next.isVisible()) {
      await advance(page, pos, () => next.click())
    } else {
      // «Повтори вслух» ещё проигрывает образец и паузу — ждём самооценку.
      await good.waitFor({ timeout: 10_000 })
    }
  }
  await expect(page.getByRole('heading', { name: SUMMARY })).toBeVisible()
  return (await page.locator('[class*="stats"]').textContent()) ?? ''
}
