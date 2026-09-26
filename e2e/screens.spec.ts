import { expect, test, type Page } from '@playwright/test'
import { advanceUntil, markSoundChecked, seedCompleted, STAGE0_BEFORE_BOSS } from './helpers.ts'

/*
  Скриншоты ключевых экранов для проверки дизайна глазами (ТЗ §14).
  Запуск: SCREENS=phase1 npx playwright test screens --project=android
  Результат — docs/screens/<SCREENS>/.
*/
const phase = process.env.SCREENS
test.skip(!phase, 'скриншоты снимаются только по запросу: SCREENS=<папка>')

async function shoot(page: Page, name: string, scheme: string, project: string, hasHeading = true) {
  if (hasHeading) await expect(page.getByRole('heading').first()).toBeAttached()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400) // живые запросы к IndexedDB (баннеры, телеметрия)
  await page.screenshot({ path: `docs/screens/${phase}/${project}-${scheme}-${name}.png` })
}

for (const scheme of ['light', 'dark'] as const) {
  test(`экраны, тема ${scheme}`, async ({ page }, info) => {
    test.setTimeout(240_000)
    const p = info.project.name
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('./')
    // Уведомление «готово офлайн» при первом запуске исчезает само через 4 с.
    await page.waitForTimeout(5000)

    // Пустые состояния — чистый профиль
    for (const [name, path] of [
      ['home', '/'],
      ['dictionary-empty', '/dictionary'],
      ['tones-empty', '/tones'],
      ['map-start', '/map'],
    ] as const) {
      await page.goto(`./#${path}`)
      await shoot(page, name, scheme, p)
    }
    await page.goto('./#/lesson/s0-u1-l1')
    await shoot(page, 'sound-check', scheme, p)

    // Урок: объяснение и вопрос с ошибкой
    await markSoundChecked(page)
    await page.goto('./#/lesson/s0-u1-l2')
    await shoot(page, 'lesson-explain', scheme, p)

    // Прогресс: пройдены 0.1 и первый урок 0.4
    await seedCompleted(page, ['s0-u1-l1', 's0-u1-l2', 's0-u1-l3', 's0-u4-l1'])
    for (const [name, path] of [
      ['session', '/session'],
      ['map-progress', '/map'],
      ['dictionary', '/dictionary'],
      ['tones-games', '/tones'],
      ['game-intro', '/game/shooter'],
      ['stats', '/stats'],
    ] as const) {
      await page.goto(`./#${path}`)
      await shoot(page, name, scheme, p)
    }
    await page.goto('./#/game/shooter?seconds=30')
    await page.getByRole('button', { name: 'Старт' }).click()
    await page.getByRole('button', { name: '4-й тон' }).click()
    await page.waitForTimeout(300)
    await shoot(page, 'game-play', scheme, p, false)

    if (phase === 'phase1') return
    // ——— Фаза 2: ступень 1, повторение, пуск из сегментов ———
    await seedCompleted(page, [...STAGE0_BEFORE_BOSS, 's0-u6-l1', 's1-u1-l1', 's1-u1-l2'])
    await page.reload()
    for (const [name, path] of [
      ['p2-session', '/session'],
      ['p2-unit', '/unit/s1-u1'],
      ['p2-stats', '/stats'],
      ['p2-map', '/map'],
      ['p2-game-speed', '/game/speed'],
    ] as const) {
      await page.goto(`./#${path}`)
      await shoot(page, name, scheme, p)
    }
    // Первый кусок повторения: карточка до и после «Показать ответ»
    await page.goto('./#/session')
    await page.getByRole('button', { name: 'Открыть' }).first().click()
    const show = page.getByRole('button', { name: 'Показать ответ' })
    if (await show.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
      await shoot(page, 'p2-card', scheme, p, false)
      await show.click()
      await shoot(page, 'p2-card-answer', scheme, p, false)
    }
    // Урок 1.1.3: фраза и «сборка»
    await page.goto('./#/lesson/s1-u1-l3')
    await shoot(page, 'p2-lesson-grammar', scheme, p)
    await advanceUntil(page, 'Фраза')
    await shoot(page, 'p2-sentence', scheme, p, false)
    await advanceUntil(page, 'Собери фразу', 60)
    await shoot(page, 'p2-assemble', scheme, p, false)
  })
}
