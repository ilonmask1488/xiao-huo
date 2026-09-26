import { expect, test, type Page } from '@playwright/test'
import { advanceUntil, markSoundChecked, passLesson, seedCompleted, STAGE0_BEFORE_BOSS } from './helpers.ts'

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
    test.setTimeout(420_000)
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

    if (phase === 'phase2') return
    // ——— Фаза 3: «Эхо», «Командировка», диалог-босс ———
    await seedCompleted(page, ['s1-u1-l3'])
    for (const [name, path] of [
      ['p3-story', '/story'],
      ['p3-echo', '/echo'],
      ['p3-unit', '/unit/s1-u1'],
    ] as const) {
      await page.goto(`./#${path}`)
      await shoot(page, name, scheme, p)
    }
    await page.goto('./#/echo/dialogue-d-s1-u1-boss')
    await shoot(page, 'p3-echo-player', scheme, p)
    await page.getByRole('button', { name: 'Только звук' }).click()
    await shoot(page, 'p3-echo-audio-only', scheme, p)
    await page.getByRole('button', { name: 'Только звук' }).click()

    // Босс этапа 1.1: реплика персонажа, выбор ответа, ответ с записью
    await page.goto('./#/lesson/s1-u1-boss')
    await shoot(page, 'p3-boss-intro', scheme, p)
    await page.getByRole('button', { name: 'Дальше', exact: true }).click()
    await expect(page.getByText('小李', { exact: true }).first()).toBeVisible()
    await shoot(page, 'p3-boss-line', scheme, p, false)
    await page.getByRole('button', { name: 'Дальше', exact: true }).click()
    await page.locator('button[data-sentence]').first().waitFor()
    await shoot(page, 'p3-boss-reply', scheme, p, false)
    await page.locator('button[data-sentence]').first().click()
    await shoot(page, 'p3-boss-answered', scheme, p, false)
    await passLesson(page, 60, 'right')
    await shoot(page, 'p3-boss-postponed', scheme, p) // первый ответ нарочно неверный
    await page.getByRole('button', { name: 'Ещё раз' }).click()
    await expect(page.getByText('1 из 9')).toBeVisible()
    await passLesson(page, 60, 'right')
    await page.waitForTimeout(3000) // анимация пуска
    await shoot(page, 'p3-boss-passed', scheme, p)

    // Эпизод 1: культурная вставка
    await page.goto('./#/lesson/story-1')
    await advanceUntil(page, 'Культура: Как обращаться к коллегам')
    await shoot(page, 'p3-culture', scheme, p)

    if (phase === 'phase3') return
    // ——— Фаза 4: карточка слова, ступень 2, график тона ———
    const stage1 = Array.from({ length: 9 }, (_, u) => [1, 2, 3].map((l) => `s1-u${u + 1}-l${l}`).concat(`s1-u${u + 1}-boss`)).flat()
    await seedCompleted(page, [...stage1, 's2-u4-l1', 's2-u10-l1'])
    await page.goto('./#/word/w-huojian')
    await expect(page.getByTestId('stroke-order').locator('svg').first()).toBeVisible()
    await shoot(page, 'p4-word', scheme, p)
    await page.getByRole('button', { name: 'Напиши сам' }).click()
    await shoot(page, 'p4-word-quiz', scheme, p)
    for (const [name, path] of [
      ['p4-map', '/map'],
      ['p4-unit', '/unit/s2-u10'],
      ['p4-dictionary', '/dictionary'],
    ] as const) {
      await page.goto(`./#${path}`)
      await shoot(page, name, scheme, p)
    }
    await page.goto('./#/lesson/s2-u10-l2')
    await shoot(page, 'p4-lesson-engineer', scheme, p)
    if (p === 'android') {
      // График тона после записи (поддельный микрофон Chromium)
      await page.goto('./#/echo/dialogue-d-s2-u10-boss')
      await page.getByRole('button', { name: 'Записать себя' }).click()
      await page.getByRole('button', { name: 'Понятно, записать' }).click()
      await page.getByRole('button', { name: 'Стоп' }).waitFor()
      await page.waitForTimeout(1500)
      await page.getByRole('button', { name: 'Стоп' }).click()
      await page.getByRole('button', { name: 'График тона' }).click()
      await page.getByTestId('pitch-chart').waitFor()
      await page.getByTestId('pitch-chart').scrollIntoViewIfNeeded()
      await shoot(page, 'p4-pitch', scheme, p)
    }

    if (phase === 'phase4') return
    // ——— Фаза 5: третья ступень, «Инженер», все эпизоды, последний босс ———
    const stage2 = Array.from({ length: 12 }, (_, u) => [1, 2, 3].map((l) => `s2-u${u + 1}-l${l}`).concat(`s2-u${u + 1}-boss`)).flat()
    const stage3 = Array.from({ length: 14 }, (_, u) => [1, 2, 3].map((l) => `s3-u${u + 1}-l${l}`).concat(`s3-u${u + 1}-boss`)).flat()
    await seedCompleted(page, [...stage2, ...stage3.filter((id) => id !== 's3-u14-boss')])
    for (const [name, path] of [
      ['p5-map', '/map'],
      ['p5-story', '/story'],
      ['p5-unit', '/unit/s3-u13'],
      ['p5-stats', '/stats'],
      ['p5-dictionary', '/dictionary'],
    ] as const) {
      await page.goto(`./#${path}`)
      await shoot(page, name, scheme, p)
    }
    await page.goto('./#/lesson/story-8')
    await page.getByRole('button', { name: 'Дальше', exact: true }).click()
    await expect(page.getByText('服务员', { exact: true }).first()).toBeVisible()
    await shoot(page, 'p5-episode8', scheme, p, false)
    await page.goto('./#/lesson/s3-u14-boss')
    await shoot(page, 'p5-boss-intro', scheme, p)
    await passLesson(page, 80, 'right')
    await page.waitForTimeout(3000)
    await shoot(page, 'p5-orbit', scheme, p)
  })
}
