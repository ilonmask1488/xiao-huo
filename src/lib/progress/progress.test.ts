import { describe, expect, it } from 'vitest'
import type { ToneStatRow } from '../db/types'
import { comboMultiplier, dvForGame, dvForLesson } from './dv'
import { buildHeatmap, hardestTone, heatmapHasData, pairWeights } from './heatmap'
import { hskForecast, minutesByDay, wordsByStage, wordsPace } from './stats'
import { addDays, computeStreak, ORBIT_DAY_SECONDS } from './streak'

const T = '2026-09-26'
const full = ORBIT_DAY_SECONDS
const days = (entries: [number, number][]) => new Map(entries.map(([offset, s]) => [addDays(T, -offset), s]))

describe('дни на орбите', () => {
  it('день засчитывается от 10 минут', () => {
    expect(computeStreak(days([[0, full - 1]]), T).days).toBe(0)
    expect(computeStreak(days([[0, full]]), T).days).toBe(1)
  })

  it('незакрытое «сегодня» не обрывает серию', () => {
    const s = computeStreak(days([[1, full], [2, full], [3, full]]), T)
    expect(s).toMatchObject({ days: 3, todayCounted: false })
  })

  it('один пропуск в неделю закрывается резервом', () => {
    const s = computeStreak(days([[0, full], [1, full], [3, full], [4, full]]), T)
    expect(s).toMatchObject({ days: 4, reserveUsed: true })
  })

  it('два пропуска за неделю обрывают серию', () => {
    const s = computeStreak(days([[0, full], [2, full], [4, full], [5, full]]), T)
    expect(s.days).toBe(2)
  })

  it('пропуски с разницей в неделю оба закрываются', () => {
    const e: [number, number][] = []
    for (let i = 0; i <= 16; i++) if (i !== 2 && i !== 10) e.push([i, full])
    expect(computeStreak(days(e), T).days).toBe(15)
  })

  it('пропуск перед началом серии — это просто начало', () => {
    expect(computeStreak(days([[0, full]]), T).days).toBe(1)
    expect(computeStreak(new Map(), T).days).toBe(0)
  })

  it('addDays переходит через месяц и год', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('статистика и прогноз', () => {
  const day = (offset: number, minutes: number, newWords = 0) => ({
    date: addDays(T, -offset),
    seconds: minutes * 60,
    dv: 0,
    spokenCount: 0,
    newWords,
  })

  it('минуты по дням: 14 дней, пропуски — нули', () => {
    const m = minutesByDay([day(0, 20), day(2, 12)], T)
    expect(m).toHaveLength(14)
    expect(m.at(-1)).toEqual({ date: T, minutes: 20 })
    expect(m.at(-2)!.minutes).toBe(0)
    expect(m.at(-3)!.minutes).toBe(12)
  })

  it('темп новых слов и прогноз до HSK', () => {
    const pace = wordsPace([day(0, 30, 7), day(1, 30, 7)], T)
    expect(pace).toBe(1)
    const learned = new Set(['w-ni', 'w-wo', 'w-shi'])
    const f = hskForecast(learned, 'hsk2', pace)
    expect(f[0]).toMatchObject({ level: 1, have: 3, need: 150, days: 147 })
    expect(hskForecast(learned, 'hsk2', 0)[0]!.days).toBeNull()
  })

  it('слова по ступеням', () => {
    const by = wordsByStage(new Set(['w-ni', 'w-ta', 'w-ma']))
    expect(by.get(0)).toBe(1)
    expect(by.get(1)).toBe(2)
  })
})

describe('Δv', () => {
  it('за урок: время, верные, попытки, вслух и бонус', () => {
    expect(dvForLesson({ seconds: 600, correct: 10, wrong: 2, spoken: 5 })).toBe(20 + 50 + 2 + 20 + 25)
  })
  it('за игру с комбо', () => {
    expect(dvForGame({ seconds: 60, correct: 10, wrong: 0, comboBonus: 7 })).toBe(2 + 50 + 7)
  })
  it('множитель комбо', () => {
    expect([0, 4, 5, 9, 10, 30].map(comboMultiplier)).toEqual([1, 1, 2, 2, 3, 3])
  })
})

describe('тепловая карта', () => {
  const stats: ToneStatRow[] = [
    { pair: '13', correct: 3, wrong: 1, confusions: { '12': 1 } },
    { pair: '33', correct: 0, wrong: 2, confusions: { '23': 2 } },
    { pair: '3', correct: 5, wrong: 5, confusions: {} },
    { pair: '1', correct: 9, wrong: 1, confusions: {} },
  ]

  it('5×5, доля ошибок, пустые ячейки — null', () => {
    const h = buildHeatmap(stats)
    expect(h).toHaveLength(5)
    expect(h.every((row) => row.length === 5)).toBe(true)
    expect(h[0]![2]).toEqual({ pair: '13', attempts: 4, errorRate: 0.25 })
    expect(h[2]![2]!.errorRate).toBe(1)
    expect(h[3]![3]).toEqual({ pair: '44', attempts: 0, errorRate: null })
  })

  it('одиночные тоны в карту не попадают', () => {
    expect(heatmapHasData([{ pair: '3', correct: 1, wrong: 0, confusions: {} }])).toBe(false)
    expect(heatmapHasData(stats)).toBe(true)
  })

  it('слабые пары весят больше', () => {
    const w = pairWeights(stats)
    expect(w.get('33')!).toBeGreaterThan(w.get('13')!)
  })

  it('самый трудный тон', () => {
    expect(hardestTone(stats)).toBe('3')
    expect(hardestTone([])).toBeNull()
  })
})
