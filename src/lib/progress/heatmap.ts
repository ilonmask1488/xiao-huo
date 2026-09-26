/*
  Тепловая карта тоновых пар 5×5: строка — тон первого слога, столбец — второго (5 — нейтральный).
  Цвет ячейки — доля ошибок. Данные — toneStats с двузначными ключами («13»).
*/
import type { ToneStatRow } from '../db/types'

export const PAIR_TONES = ['1', '2', '3', '4', '5'] as const

export type HeatCell = {
  pair: string
  attempts: number
  errorRate: number | null // null — нет данных
}

export function buildHeatmap(stats: ToneStatRow[]): HeatCell[][] {
  const byPair = new Map(stats.filter((s) => s.pair.length === 2).map((s) => [s.pair, s]))
  return PAIR_TONES.map((a) =>
    PAIR_TONES.map((b) => {
      const s = byPair.get(a + b)
      const attempts = s ? s.correct + s.wrong : 0
      return { pair: a + b, attempts, errorRate: attempts ? s!.wrong / attempts : null }
    }),
  )
}

/** Есть ли вообще данные для карты. */
export function heatmapHasData(stats: ToneStatRow[]): boolean {
  return stats.some((s) => s.pair.length === 2 && s.correct + s.wrong > 0)
}

/** Пары, в которых чаще ошибаешься (для «слабые пары выпадают чаще»). Вес ≥ 1. */
export function pairWeights(stats: ToneStatRow[]): Map<string, number> {
  const w = new Map<string, number>()
  for (const s of stats) {
    if (s.pair.length !== 2) continue
    const n = s.correct + s.wrong
    // сглаживание: новая пара — вес 1.5, частые ошибки — до 4
    w.set(s.pair, 1 + (3 * (s.wrong + 0.5)) / (n + 1))
  }
  return w
}

/** Самый трудный одиночный тон по статистике (ключи «1»…«5»). */
export function hardestTone(stats: ToneStatRow[]): string | null {
  let best: { t: string; rate: number } | null = null
  for (const s of stats) {
    if (s.pair.length !== 1) continue
    const n = s.correct + s.wrong
    if (n < 3) continue
    const rate = s.wrong / n
    if (!best || rate > best.rate) best = { t: s.pair, rate }
  }
  return best && best.rate > 0 ? best.t : null
}
