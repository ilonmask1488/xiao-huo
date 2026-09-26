/*
  Статистика: минуты по дням, слова по ступеням, прогноз «до HSK».
  Размеры уровней HSK (накопительно) посчитаны по drkameleon/complete-hsk-vocabulary:
  HSK 2.0 — 150 / 297 / 595 слов, HSK 3.0 — 506 / 1256 / 2209.
*/
import { unitById, unitOfWord, wordById } from '../../content'
import type { DayRow, HskScale } from '../db/types'
import { addDays } from './streak'

export const HSK_TOTALS: Record<HskScale, [number, number, number]> = {
  hsk2: [150, 297, 595],
  hsk3: [506, 1256, 2209],
}

/** Минуты за последние n дней (включая сегодня), по порядку. */
export function minutesByDay(days: DayRow[], today: string, n = 14): { date: string; minutes: number }[] {
  const by = new Map(days.map((d) => [d.date, d.seconds]))
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    return { date, minutes: Math.round((by.get(date) ?? 0) / 60) }
  })
}

/** Сколько изученных слов на каждой ступени. */
export function wordsByStage(learned: Set<string>): Map<number, number> {
  const out = new Map<number, number>()
  for (const id of learned) {
    const u = unitById.get(unitOfWord.get(id) ?? '')
    if (!u) continue
    out.set(u.stage, (out.get(u.stage) ?? 0) + 1)
  }
  return out
}

export type Forecast = { level: 1 | 2 | 3; have: number; need: number; days: number | null }

/**
  Прогноз до HSK 1/2/3: слова этого уровня, которые уже в работе, и сколько дней при нынешнем темпе.
  Темп — новые слова в день за последние 14 дней. Нет темпа — прогноза нет (честно).
*/
export function hskForecast(learned: Set<string>, scale: HskScale, wordsPerDay: number): Forecast[] {
  const totals = HSK_TOTALS[scale]
  return ([1, 2, 3] as const).map((level) => {
    let have = 0
    for (const id of learned) {
      const w = wordById.get(id)
      const lv = scale === 'hsk2' ? w?.hsk2 : w?.hsk3
      if (lv && lv <= level) have++
    }
    const need = totals[level - 1]!
    const left = Math.max(0, need - have)
    return { level, have, need, days: left === 0 ? 0 : wordsPerDay > 0 ? Math.ceil(left / wordsPerDay) : null }
  })
}

/** Новых слов в день за последние n дней. */
export function wordsPace(days: DayRow[], today: string, n = 14): number {
  const since = addDays(today, -n + 1)
  const total = days.filter((d) => d.date >= since).reduce((s, d) => s + d.newWords, 0)
  return total / n
}
