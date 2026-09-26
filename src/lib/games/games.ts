/*
  Мини-игры ступени 0: общие правила и подбор материала.
  60 секунд, комбо ×2 после 5 верных подряд и ×3 после 10, ошибка сбрасывает комбо, но не заканчивает игру.
  Все игры используют только пройденный материал.
*/
import { lessonOrder, wordById } from '../../content'
import type { Syllable, WordId } from '../../content/types'
import { db } from '../db/db'
import { pairOf, rng } from '../lesson/build'
import type { Tone } from '../pinyin/marks'
import { localDate } from '../progress/streak'

export type GameId = 'shooter' | 'pingpong' | 'twins'
export const ROUND_SECONDS = 60

export type Twin = { answer: Syllable; options: Syllable[]; contrast: string; skill: 'initial' | 'final' | 'tone' }

export type GameMaterial = {
  shooter: { syllables: Syllable[]; tones: Tone[] }
  pingpong: { words: WordId[] }
  twins: { pairs: Twin[] }
}

/** Что из пройденного годится для каждой игры. */
export function gameMaterial(completed: Set<string>): GameMaterial {
  const syl = new Set<Syllable>()
  const tones = new Set<Tone>()
  const words = new Set<WordId>()
  const twins: Twin[] = []
  for (const l of lessonOrder) {
    if (!completed.has(l.id)) continue
    for (const p of l.parts) {
      if (p.type === 'guessTone') {
        p.items.forEach((s) => syl.add(s))
        p.choices.forEach((t) => tones.add(t))
      }
      if (p.type === 'guessPair') p.items.forEach((w) => words.add(w))
      if (p.type === 'whichSyllable')
        p.items.forEach((it) => twins.push({ ...it, contrast: p.contrast.label, skill: p.contrast.skill }))
    }
  }
  const t = [...tones].sort() as Tone[]
  return {
    shooter: { syllables: [...syl].filter((s) => t.includes(Number(s.slice(-1)) as Tone)), tones: t },
    pingpong: { words: [...words].filter((w) => wordById.has(w)) },
    twins: { pairs: twins },
  }
}

export function gameAvailable(id: GameId, m: GameMaterial): boolean {
  if (id === 'shooter') return m.shooter.syllables.length >= 4
  if (id === 'pingpong') return m.pingpong.words.length >= 4
  return m.twins.pairs.length >= 4
}

/** Какой урок открывает игру (для подсказки, если материала ещё нет). */
export const UNLOCKED_BY: Record<GameId, string> = {
  shooter: 's0-u1-l1',
  pingpong: 's0-u4-l1',
  twins: 's0-u2-l1',
}

/**
  Взвешенный выбор: слабые пары выпадают чаще, «фокусная» — ещё чаще.
  Не повторяет только что прозвучавшее.
*/
export function weightedPick<T>(items: T[], weight: (x: T) => number, random: () => number, avoid?: T): T {
  const pool = items.length > 1 && avoid !== undefined ? items.filter((x) => x !== avoid) : items
  const total = pool.reduce((s, x) => s + weight(x), 0)
  let r = random() * total
  for (const x of pool) {
    r -= weight(x)
    if (r <= 0) return x
  }
  return pool[pool.length - 1]!
}

export function pairWeightFor(word: WordId, weights: Map<string, number>, focus?: string | null): number {
  const pair = pairOf(word)
  return (weights.get(pair) ?? 1.5) * (focus && pair === focus ? 4 : 1)
}

export function gameRandom(): () => number {
  return rng((Date.now() ^ (Math.random() * 1e9)) >>> 0)
}

/** Интервал между вопросами «Тон-тира»: темп растёт с серией верных ответов. */
export function shooterDelay(streak: number): number {
  return Math.max(250, 900 - streak * 60)
}

/** Время на ответ в «Тон-тире»: от 5 до 2,5 секунды. */
export function shooterTimeLimit(streak: number): number {
  return Math.max(2500, 5000 - streak * 150)
}

/** Сохранить рекорд (за всё время и за неделю). Возвращает, побит ли рекорд. */
export async function saveRecord(game: GameId, score: number): Promise<{ best: number; weekBest: number; isBest: boolean }> {
  const week = weekStart(localDate())
  return db.transaction('rw', db.gameRecords, async () => {
    const cur = (await db.gameRecords.get(game)) ?? { game, best: 0, weekBest: 0, weekStart: week }
    const weekBest = cur.weekStart === week ? cur.weekBest : 0
    const row = { game, best: Math.max(cur.best, score), weekBest: Math.max(weekBest, score), weekStart: week }
    await db.gameRecords.put(row)
    return { best: row.best, weekBest: row.weekBest, isBest: score > cur.best && score > 0 }
  })
}

/** Понедельник недели (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d)
  const shift = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - shift)
  return localDate(dt)
}
