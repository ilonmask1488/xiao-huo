import { expect, test } from '@playwright/test'
import { markSoundChecked, passLesson, seedCompleted, STAGE0_BEFORE_BOSS } from './helpers.ts'

const STAGE0_ALL = [...STAGE0_BEFORE_BOSS, 's0-u6-l1']
const stageLessons = (stage: number, units: number) =>
  Array.from({ length: units }, (_, u) => [1, 2, 3].map((l) => `s${stage}-u${u + 1}-l${l}`).concat(`s${stage}-u${u + 1}-boss`)).flat()
const STAGE1_ALL = stageLessons(1, 9)
const STAGE2_ALL = stageLessons(2, 12)
const STAGE3_ALL = stageLessons(3, 14)
const BEFORE_LAST_BOSS = [...STAGE0_ALL, ...STAGE1_ALL, ...STAGE2_ALL, ...STAGE3_ALL.filter((id) => id !== 's3-u14-boss')]

test('карта: третья ступень открыта, 14 этапов, «Инженер» среди них', async ({ page }) => {
  await markSoundChecked(page)
  await page.goto('./#/map')
  await expect(page.getByRole('heading', { name: 'Выход на орбиту' })).toBeVisible()
  await expect(page.getByText('0 из 56 уроков')).toBeVisible()
  await expect(page.getByRole('button', { name: /3\.1 Внешность и характер/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /3\.14 Инженер: испытания и качество/ })).toBeVisible()
})

test('последний босс курса: «Пуск!» и достижение «На орбите»', async ({ page }) => {
  test.setTimeout(240_000)
  await markSoundChecked(page)
  await seedCompleted(page, BEFORE_LAST_BOSS)
  await page.goto('./#/lesson/s3-u14-boss')
  await expect(page.getByRole('heading', { name: 'Огневые испытания: пуск' })).toBeVisible({ timeout: 20_000 })
  await passLesson(page, 80, 'right')
  await expect(page.getByRole('heading', { name: 'Пуск!' })).toBeVisible()
  await expect(page.getByText(/Этап 3\.14 «Инженер: испытания и качество» закрыт/)).toBeVisible()
  await expect(page.getByText('На орбите')).toBeVisible()
  await expect(page.getByText(/курс завершён/)).toBeVisible()
})

test('«Командировка»: все восемь эпизодов, финальный «干杯» проходится до конца', async ({ page }) => {
  test.setTimeout(240_000)
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, ...STAGE1_ALL, ...STAGE2_ALL, ...STAGE3_ALL])
  await page.goto('./#/story')
  // После посева ~110 уроков первый расчёт состояний эпизодов на WebKit под нагрузкой идёт долго
  await expect(page.getByText('Эпизод 1', { exact: true })).toBeVisible({ timeout: 30_000 })
  for (const n of [2, 3, 4, 5, 6, 7, 8]) await expect(page.getByText(`Эпизод ${n}`, { exact: true })).toBeVisible()
  await expect(page.getByText(/Это все восемь эпизодов/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Прощальный ужин и 干杯！' })).toBeVisible()
  // Ни одного «лучше после этапа» — всё открыто
  await expect(page.getByText(/лучше после этапа/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Смотреть' }).last().click()
  await expect(page.getByRole('heading', { name: 'Прощальный ужин и 干杯！' })).toBeVisible()
  await passLesson(page, 80)
  await expect(page.getByRole('heading', { name: 'Урок пройден' })).toBeVisible()
  await page.getByRole('button', { name: 'К сюжету' }).click()
  await expect(page.getByText('✓ пройден')).toHaveCount(1)
})

test('словарь и «Эхо» знают третью ступень: HSK 3, «Инженер», дорожки этапа', async ({ page }) => {
  await markSoundChecked(page)
  await seedCompleted(page, [...STAGE0_ALL, ...STAGE1_ALL, ...STAGE2_ALL, 's3-u13-l1'])
  await page.goto('./#/dictionary')
  await page.getByRole('radio', { name: 'HSK 3' }).click()
  await expect(page.getByText('аэрокосмическая компания')).toHaveCount(0)
  await page.getByRole('radio', { name: 'Инженер' }).click()
  await expect(page.getByText('углеволокно')).toBeVisible()
  await page.goto('./#/echo')
  await expect(page.getByRole('button', { name: /3\.13.*Инженер: материалы и производство/ })).toBeVisible()
})
