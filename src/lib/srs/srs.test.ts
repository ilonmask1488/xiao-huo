import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDB } from '../db/db'
import type { CardRow } from '../db/types'
import { answerCard, ensureCardsForLesson, ensureHanziOnlyCards, hanziOnlyAllowed, mixKinds, retentionStats, reviewQueue } from './cards'
import { formatInterval, formatWhen, newCard, previewIntervals, review } from './srs'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 8, 26, 9)

let n = 0
const opened: AppDB[] = []
function freshDb(): AppDB {
  const d = new AppDB(`test-srs-${n++}`)
  opened.push(d)
  return d
}
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

describe('FSRS-обёртка', () => {
  it('новая карточка сразу к повторению, «Хорошо» откладывает, «Снова» возвращает скоро', () => {
    const c = newCard('w-ni', 1, T0)
    expect(c.due).toBe(T0)
    expect(c.state).toBe(0)
    const good = review(c, 3, T0)
    const again = review(c, 1, T0)
    expect(good.due).toBeGreaterThan(again.due)
    expect(good.reps).toBe(1)
  })

  it('интервалы растут: Снова < Трудно ≤ Хорошо < Легко', () => {
    let c = newCard('w-ni', 1, T0)
    c = review(c, 3, T0)
    c = review(c, 3, c.due)
    const p = previewIntervals(c, c.due)
    expect(p[1]).toBeLessThan(p[3])
    expect(p[2]).toBeLessThanOrEqual(p[3])
    expect(p[3]).toBeLessThan(p[4])
  })

  it('в базе — только числа (бэкап без потерь)', () => {
    const c = review(newCard('w-ni', 1, T0), 3, T0)
    for (const v of Object.values(c)) expect(['string', 'number', 'undefined']).toContain(typeof v)
    expect(JSON.parse(JSON.stringify(c))).toEqual(c)
  })

  it('когда вернётся карточка — словами', () => {
    expect(formatWhen(30_000)).toBe('через 1 мин')
    expect(formatWhen(10 * 60_000)).toBe('через 10 мин')
    expect(formatWhen(6 * 60 * 60_000)).toBe('через 6 ч')
    expect(formatWhen(DAY)).toBe('завтра')
    expect(formatWhen(3 * DAY)).toBe('через 3 дня')
    expect(formatWhen(8 * DAY)).toBe('через 8 дней')
    expect(formatWhen(21 * DAY)).toBe('через 3 нед')
    expect(formatWhen(90 * DAY)).toBe('через 3 мес')
  })

  it('подписи интервалов', () => {
    expect(formatInterval(5 * 60_000)).toBe('5 мин')
    expect(formatInterval(3 * 60 * 60_000)).toBe('3 ч')
    expect(formatInterval(3 * DAY)).toBe('3 д')
    expect(formatInterval(21 * DAY)).toBe('3 нед')
    expect(formatInterval(90 * DAY)).toBe('3 мес')
  })
})

describe('карточки в базе', () => {
  it('урок создаёт карточки типа 1 для своих слов, повторно — не дублирует', async () => {
    const d = freshDb()
    expect(await ensureCardsForLesson('s0-u1-l3', d, T0)).toBe(7)
    expect(await ensureCardsForLesson('s0-u1-l3', d, T0)).toBe(0)
    expect(await d.cards.count()).toBe(7)
  })

  it('типы открываются постепенно: 1 → 2 и 4 → 3', async () => {
    const d = freshDb()
    await ensureCardsForLesson('s0-u1-l3', d, T0)
    expect(await answerCard('w-ni:1', 1, 3000, 0.9, d, T0)).toEqual([]) // «Снова» ничего не открывает
    expect(await answerCard('w-ni:1', 3, 3000, 0.9, d, T0 + 60_000)).toEqual([2, 4])
    expect(await answerCard('w-ni:2', 3, 3000, 0.9, d, T0 + 2 * DAY)).toEqual([3])
    expect(await d.cards.get('w-ni:3')).toBeDefined()
    // открытые типы приходят не сразу, а к следующему занятию
    expect((await d.cards.get('w-ni:4'))!.due).toBeGreaterThan(T0 + 60_000)
    expect(await d.reviews.count()).toBe(3)
  })

  it('тип 5 «только иероглифы»: со второй ступени или по настройке, и догоняет уже выученные', async () => {
    const d = freshDb()
    await ensureCardsForLesson('s0-u1-l3', d, T0)
    await answerCard('w-ni:1', 3, 3000, 0.9, d, T0)
    // До второй ступени тип 2 открывает только тип 3
    expect(await hanziOnlyAllowed(d)).toBe(false)
    expect(await answerCard('w-ni:2', 3, 3000, 0.9, d, T0 + DAY)).toEqual([3])
    expect(await ensureHanziOnlyCards(d, T0 + DAY)).toBe(0)

    // Пройден урок второй ступени — тип 5 открывается; уже выученные карточки типа 2 его догоняют
    await d.lessonProgress.put({ lessonId: 's2-u1-l1', step: 0, results: {}, startedAt: T0, updatedAt: T0, seconds: 60, completedAt: T0, timesCompleted: 1 })
    expect(await hanziOnlyAllowed(d)).toBe(true)
    await d.cards.update('w-ni:2', { state: 2 })
    expect(await ensureHanziOnlyCards(d, T0 + 2 * DAY)).toBe(1)
    expect(await ensureHanziOnlyCards(d, T0 + 2 * DAY)).toBe(0)
    expect((await d.cards.get('w-ni:5'))!.kind).toBe(5)

    // По настройке — и без второй ступени
    const e = freshDb()
    await e.settings.put({ id: 'main', hanziOnlyCardsEarly: true })
    await ensureCardsForLesson('s0-u1-l3', e, T0)
    await answerCard('w-ni:1', 3, 3000, 0.9, e, T0)
    expect(await answerCard('w-ni:2', 3, 3000, 0.9, e, T0 + DAY)).toEqual([3, 5])
  })

  it('очередь: сначала просроченные, лимит и флаг перегрузки', async () => {
    const d = freshDb()
    await ensureCardsForLesson('s0-u1-l3', d, T0)
    const q = await reviewQueue(3, d, T0 + 1000)
    expect(q).toMatchObject({ totalDue: 7, capped: true })
    expect(q.cards).toHaveLength(3)
    expect((await reviewQueue(50, d, T0 - 1)).totalDue).toBe(0)
  })

  it('типы в очереди перемешаны: не больше 3 одного типа подряд', () => {
    const mk = (i: number, kind: 1 | 2 | 3 | 4): CardRow => ({ ...newCard(`w-${i}`, kind === 3 ? 3 : kind, T0), kind })
    const cards = [...Array.from({ length: 6 }, (_, i) => mk(i, 1)), mk(10, 2), mk(11, 4)]
    const mixed = mixKinds(cards)
    let run = 1
    let max = 1
    for (let i = 1; i < mixed.length; i++) {
      run = mixed[i]!.kind === mixed[i - 1]!.kind ? run + 1 : 1
      max = Math.max(max, run)
    }
    expect(mixed).toHaveLength(8)
    expect(max).toBeLessThanOrEqual(3)
  })

  it('удержание считается по зрелым карточкам', async () => {
    const d = freshDb()
    await d.reviews.bulkAdd([
      { cardId: 'a', at: T0, rating: 3, durationMs: 1, stateBefore: 2 },
      { cardId: 'b', at: T0, rating: 1, durationMs: 1, stateBefore: 2 },
      { cardId: 'c', at: T0, rating: 1, durationMs: 1, stateBefore: 0 },
    ])
    expect(await retentionStats(d, 10 * DAY, T0 + 1)).toMatchObject({ reviews: 3, mature: 2, retention: 0.5 })
  })
})
