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

/* ——— UX, шаг 3: инструкции упражнений, «?», перевод по тапу, счётчики, первый запуск ——— */
test('UX шаг 3: уроки, счётчики, первый запуск', async ({ page }, info) => {
  test.skip(phase !== 'ux3')
  test.setTimeout(420_000)
  const p = info.project.name
  const scheme = 'light'
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  await page.goto('./')
  await page.waitForTimeout(5000)
  const dialog = page.getByRole('dialog', { name: 'Как здесь учиться' })
  await expect(dialog).toBeVisible()
  await shoot(page, 'welcome-1', scheme, p)
  await dialog.getByRole('button', { name: 'Дальше' }).click()
  await dialog.getByRole('button', { name: 'Дальше' }).click()
  await dialog.getByRole('button', { name: 'Дальше' }).click()
  await shoot(page, 'welcome-4', scheme, p)
  await dialog.getByRole('button', { name: 'Начать' }).click()

  // Счётчик объясняется по тапу
  await page.getByRole('button', { name: /Дни подряд · на орбите: объяснить/ }).click()
  await shoot(page, 'term-streak', scheme, p)
  await page.getByRole('button', { name: 'Понятно' }).click()
  await page.goto('./#/how')
  await shoot(page, 'how', scheme, p)

  // Урок 0.1.1: подсказка при первой встрече с упражнением, «Послушай серию» с инструкцией и «?»
  await markSoundChecked(page)
  await page.goto('./#/lesson/s0-u1-l1')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await page.getByRole('button', { name: 'Понятно' }).waitFor()
  await shoot(page, 'ex-repeat-coach', scheme, p, false)
  await page.getByRole('button', { name: 'Понятно' }).click()
  await advanceUntil(page, 'Послушай серию')
  await shoot(page, 'ex-listen', scheme, p, false)
  await page.getByRole('button', { name: 'Как работает это упражнение' }).click()
  await shoot(page, 'ex-listen-help', scheme, p, false)
  await page.getByRole('button', { name: 'Понятно' }).click()
  await advanceUntil(page, 'Какой тон прозвучал? Выбери')
  await page.getByRole('button', { name: 'Понятно' }).click({ timeout: 3000 }).catch(() => {})
  await shoot(page, 'ex-guess-tone', scheme, p, false)

  // Урок 1.1.3: фраза с переводом по тапу, «угадай значение», сборка
  await seedCompleted(page, [...STAGE0_BEFORE_BOSS, 's0-u6-l1', 's1-u1-l1', 's1-u1-l2'])
  await page.goto('./#/lesson/s1-u1-l3')
  await advanceUntil(page, 'Разбери фразу по словам')
  await page.getByRole('button', { name: 'Понятно' }).click({ timeout: 3000 }).catch(() => {})
  await shoot(page, 'ex-sentence', scheme, p, false)
  await page.locator('button[class*="tokenBtn"]').first().click()
  await expect(page.getByTestId('word-sheet')).toBeVisible()
  await shoot(page, 'ex-word-sheet', scheme, p, false)
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await advanceUntil(page, 'Собери фразу из слов', 60)
  await page.getByRole('button', { name: 'Понятно' }).click({ timeout: 3000 }).catch(() => {})
  await shoot(page, 'ex-assemble', scheme, p, false)

  // Диалог: реплика с переводом и инструкцией
  await seedCompleted(page, ['s1-u1-l3'])
  await page.goto('./#/lesson/s1-u1-boss')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await expect(page.getByText('小李', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Понятно' }).click({ timeout: 3000 }).catch(() => {})
  await shoot(page, 'ex-line', scheme, p, false)
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await page.locator('button[data-sentence]').first().waitFor()
  await page.getByRole('button', { name: 'Понятно' }).click({ timeout: 3000 }).catch(() => {})
  await shoot(page, 'ex-reply', scheme, p, false)

  // Профиль и статистика: термины подчёркнуты
  await page.goto('./#/more')
  await shoot(page, 'profile', scheme, p)
  await page.goto('./#/stats')
  await page.getByRole('button', { name: /Очки · Δv: объяснить/ }).click()
  await shoot(page, 'stats-term', scheme, p)
})

/* ——— UX §8: прогулка новичка — каждый экран и состояние от первого запуска до конца занятия ——— */
const SLUG: Record<string, string> = {
  'Послушай серию': 'listen',
  'Повтори вслух': 'repeat',
  'Прочитай вслух': 'read',
  'Какой тон прозвучал? Выбери': 'guess-tone',
  'Какой слог прозвучал? Выбери': 'which-syllable',
  'Какие тоны в слове? Выбери пару': 'guess-pair',
  'Послушай и выбери, что это значит': 'meaning-audio',
  'Прочитай и выбери, что это значит': 'meaning-text',
  'Разбери фразу по словам': 'sentence',
  'Собери фразу из слов': 'assemble',
  'Скажи по-китайски': 'say-it',
}

test('аудит: прогулка новичка', async ({ page }, info) => {
  test.skip(phase !== 'audit')
  test.setTimeout(600_000)
  const p = info.project.name
  const scheme = 'light'
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
  let n = 0
  const shot = (name: string, heading = true) => shoot(page, `${String(++n).padStart(2, '0')}-${name}`, scheme, p, heading)

  // Первый запуск
  await page.goto('./')
  await page.waitForTimeout(5000)
  const dialog = page.getByRole('dialog', { name: 'Как здесь учиться' })
  await expect(dialog).toBeVisible()
  for (let i = 1; i <= 4; i++) {
    await shot(`welcome-${i}`)
    await dialog.getByRole('button', { name: i < 4 ? 'Дальше' : 'Начать' }).click()
  }
  await shot('today')
  await page.getByRole('button', { name: /Дни подряд · на орбите: объяснить/ }).click()
  await shot('today-term-streak')
  await page.getByRole('button', { name: 'Понятно' }).click()
  await page.getByRole('link', { name: 'Подробнее о занятии' }).click()
  await shot('session-plan')

  // Остальные вкладки до занятия
  for (const [name, path] of [
    ['course', '/map'],
    ['train', '/train'],
    ['tones', '/tones'],
    ['games-locked', '/games'],
    ['echo-empty', '/echo'],
    ['story', '/story'],
    ['dictionary-empty', '/dictionary'],
    ['profile', '/more'],
    ['stats', '/stats'],
    ['settings', '/settings'],
    ['how', '/how'],
    ['about', '/about'],
  ] as const) {
    await page.goto(`./#${path}`)
    await shot(name)
  }

  // Занятие целиком: проверка звука → урок (каждый тип экрана и отклик) → итоги
  await page.goto('./#/')
  await page.getByRole('button', { name: 'Начать занятие' }).click()
  await shot('sound-check')
  await page.getByRole('button', { name: /^Послушать/ }).click()
  await page.getByRole('button', { name: 'Слышу', exact: true }).click()
  const seenKinds = new Set<string>()
  let explains = 0
  const kindOf = async () => {
    if (await page.locator('h1').first().isVisible()) return 'explain'
    return (await page.locator('[class*="cardHead"] [class*="kicker"]').first().textContent({ timeout: 2000 }).catch(() => ''))?.trim() ?? ''
  }
  await passLesson(page, 80, 'right', {
    onScreen: async () => {
      const kind = await kindOf()
      if (kind === 'explain') {
        if (explains++ < 2) await shot(`lesson-explain-${explains}`, false)
        return
      }
      const slug = SLUG[kind] ?? 'exercise'
      if (seenKinds.has(slug)) return
      seenKinds.add(slug)
      await shot(`lesson-${slug}`, false)
      if (slug === 'listen' || slug === 'repeat' || slug === 'guess-tone') {
        await page.getByRole('button', { name: 'Как работает это упражнение' }).click()
        await shot(`lesson-${slug}-help`, false)
        await page.getByRole('button', { name: 'Понятно' }).click()
      }
    },
    afterAnswer: async () => {
      const slug = SLUG[await kindOf()] ?? 'exercise'
      if (seenKinds.has(`${slug}-answered`)) return
      seenKinds.add(`${slug}-answered`)
      await shot(`lesson-${slug}-answered`, false)
    },
  })
  await shot('lesson-summary')
  await page.getByRole('button', { name: 'Дальше по занятию' }).click()
  await shot('session-after-lesson')

  // Разминка-игра (короткий раунд для теста) и «Повтори за диктором»
  await page.getByRole('button', { name: /^(Начать|Продолжить): Разминка/ }).click()
  await shot('game-intro')
  await page.goto(`${page.url()}&seconds=8`)
  await page.getByRole('button', { name: 'Старт' }).click()
  await page.waitForTimeout(1500)
  await shot('game-play', false)
  await page.getByRole('heading', { name: 'Раунд окончен' }).waitFor({ timeout: 20_000 })
  await shot('game-end')
  await page.getByRole('button', { name: 'Дальше по занятию' }).click()
  await page.getByRole('button', { name: /^(Начать|Продолжить): Повтори за диктором/ }).click()
  await page.getByRole('button', { name: 'Понятно', exact: true }).click({ timeout: 3000 }).catch(() => {})
  await shot('echo-block', false)
  await passLesson(page, 40)
  await shot('echo-summary')
  await page.getByRole('button', { name: 'Дальше по занятию' }).click()
  await shot('session-done')
  await page.goto('./#/')
  await shot('today-done')

  // После занятия: словарь наполнился, карточка слова, курс и статистика сдвинулись
  await page.goto('./#/dictionary')
  await shot('dictionary')
  await page.goto('./#/word/w-ni')
  await shot('word')
  await page.goto('./#/map')
  await shot('course-after')
  await page.goto('./#/stats')
  await shot('stats-after')
})

for (const scheme of ['light', 'dark'] as const) {
  test(`экраны, тема ${scheme}`, async ({ page }, info) => {
    test.skip(!!phase?.startsWith('ux') || phase === 'audit')
    test.setTimeout(420_000)
    const p = info.project.name
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    await page.goto('./')
    // Уведомление «готово офлайн» при первом запуске исчезает само через 4 с.
    await page.waitForTimeout(5000)
    await page.getByRole('button', { name: 'Пропустить' }).click()

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
    await page.getByRole('button', { name: 'Понятно', exact: true }).click({ timeout: 5000 }).catch(() => {})
    const show = page.getByRole('button', { name: 'Проверить себя' })
    if (await show.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
      await shoot(page, 'p2-card', scheme, p, false)
      await show.click()
      await shoot(page, 'p2-card-answer', scheme, p, false)
    }
    // Урок 1.1.3: фраза и «сборка»
    await page.goto('./#/lesson/s1-u1-l3')
    await shoot(page, 'p2-lesson-grammar', scheme, p)
    await advanceUntil(page, 'Разбери фразу по словам')
    await shoot(page, 'p2-sentence', scheme, p, false)
    await advanceUntil(page, 'Собери фразу из слов', 60)
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
