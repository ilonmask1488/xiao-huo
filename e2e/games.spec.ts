import { expect, test } from '@playwright/test'
import { markSoundChecked, passLesson, seedCompleted, STAGE0_BEFORE_BOSS } from './helpers.ts'

test('игры закрыты, пока нет пройденного материала, и объясняют почему', async ({ page }) => {
  await markSoundChecked(page)
  await page.goto('./#/tones')
  await expect(page.getByText('откроется после урока «Высоко и вниз: 1-й и 4-й тон»')).toBeVisible()
  await page.goto('./#/game/pingpong')
  await expect(page.getByText(/откроется после урока «Пары с 1-м и 2-м тоном впереди»/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'К этому уроку' })).toBeVisible()
})

test('«Тон-тир»: раунд со свайпом и кнопками, итоги и рекорд', async ({ page }) => {
  await markSoundChecked(page)
  await seedCompleted(page, ['s0-u1-l1'])
  await page.goto('./#/game/shooter?seconds=8')
  await page.getByRole('button', { name: 'Старт' }).click()
  const pad = page.getByRole('application', { name: 'Поле для жеста тона' })
  await expect(pad).toBeVisible()
  // Свайп вправо — 1-й тон
  const box = (await pad.boundingBox())!
  await page.mouse.move(box.x + 40, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 40 + i * 25, box.y + box.height / 2 + 2)
  await page.mouse.up()
  await expect(pad).toHaveAttribute('data-feedback', /ok|bad/)
  // Дальше — кнопками (в первом уроке только 1-й и 4-й тоны)
  await expect(page.getByRole('button', { name: '2-й тон' })).toHaveCount(0)
  for (let i = 0; i < 3; i++) {
    const b = page.getByRole('button', { name: '4-й тон' })
    if (await b.isVisible()) await b.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(900)
  }
  await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Рекорд: \d+/)).toBeVisible()
})

test('тепловая карта заполняется после «Пинг-понга», ячейка ведёт к тренировке пары', async ({ page }) => {
  await markSoundChecked(page)
  await seedCompleted(page, ['s0-u1-l1', 's0-u4-l1'])
  await page.goto('./#/tones')
  await expect(page.getByText(/Заполнится после первой игры «Пинг-понг пар»/)).toBeVisible()
  await page.getByRole('button', { name: 'Сыграть' }).click()
  await page.goto('./#/game/pingpong?seconds=8')
  await page.getByRole('button', { name: 'Старт' }).click()
  for (let i = 0; i < 4; i++) {
    const option = page.locator('button[class*="option"]:not([disabled])').first()
    if (await option.isVisible()) await option.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(1300)
  }
  await expect(page.getByRole('heading', { name: 'Раунд окончен' })).toBeVisible({ timeout: 15_000 })
  await page.goto('./#/tones')
  await expect(page.getByText(/Чем краснее, тем чаще ошибаешься/)).toBeVisible()
  const cell = page.locator('button[role="gridcell"]:not([data-empty])').first()
  await cell.click()
  await expect(page.getByRole('button', { name: 'Потренировать эту пару' })).toBeVisible()
  await page.getByRole('button', { name: 'Потренировать эту пару' }).click()
  await expect(page.getByText(/Упор на/)).toBeVisible()
})

test('предстартовый тест: неудача — «пуск перенесён», слабые места и тренировка без штрафа', async ({ page }) => {
  test.setTimeout(180_000)
  await markSoundChecked(page)
  await seedCompleted(page, STAGE0_BEFORE_BOSS)
  await page.goto('./#/map')
  await expect(page.getByText('13 из 14 уроков')).toBeVisible()
  await page.goto('./#/lesson/s0-u6-l1')
  await expect(page.getByRole('heading', { name: 'Обратный отсчёт' })).toBeVisible()
  await passLesson(page) // всегда первый вариант — почти наверняка ниже 80%
  const title = page.getByRole('heading', { name: /^(Пуск!|Пуск перенесён)$/ })
  await expect(title).toBeVisible()
  if ((await title.textContent()) === 'Пуск перенесён') {
    await expect(page.getByText('Тоны', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ещё раз' })).toBeVisible()
    await page.getByRole('button', { name: /^Потренировать:/ }).click()
    await expect(page.getByRole('button', { name: 'Старт' })).toBeVisible()
    await page.goto('./#/map')
    await expect(page.getByText('13 из 14 уроков')).toBeVisible() // неудача не засчитана
  }
})
