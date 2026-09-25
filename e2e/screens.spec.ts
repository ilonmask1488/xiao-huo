import { expect, test } from '@playwright/test'

/*
  Скриншоты ключевых экранов для проверки дизайна глазами (ТЗ §14).
  Запуск: SCREENS=phase0 npx playwright test screens --project=android
  Результат — docs/screens/<SCREENS>/.
*/
const phase = process.env.SCREENS
test.skip(!phase, 'скриншоты снимаются только по запросу: SCREENS=<папка>')

const SCREENS: [string, string][] = [
  ['home', '/'],
  ['map', '/map'],
  ['tones', '/tones'],
  ['dictionary', '/dictionary'],
  ['more', '/more'],
  ['settings', '/settings'],
  ['session', '/session'],
]

for (const scheme of ['light', 'dark'] as const) {
  test(`экраны, тема ${scheme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    for (const [name, path] of SCREENS) {
      await page.goto(`./#${path}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `docs/screens/${phase}/${info.project.name}-${scheme}-${name}.png` })
    }
  })
}
