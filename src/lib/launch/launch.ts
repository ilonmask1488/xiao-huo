/*
  Ежедневный «пуск» фазы 1. Пока нет повторения FSRS (фаза 2), собирается из того, что есть:
  - Разминка — «Угадай тон» по пройденным слогам (потом — мини-игра);
  - Повторение — пропускается до фазы 2;
  - Новое — следующий урок;
  - Эхо — «Повтори вслух» по пройденному;
  - Скажи сам — «Прочитай» пройденные слова и слоги.
  Блоки без содержания пропускаются.
*/
import { lessonById, lessonOrder } from '../../content'
import type { Item, Syllable } from '../../content/types'
import { db } from '../db/db'
import { gameAvailable, gameMaterial } from '../games/games'
import type { LaunchBlockState, LaunchRow } from '../db/types'
import { hash, interleave, shuffle, type Screen } from '../lesson/build'
import { completedLessonIds, nextLessonId } from '../lesson/progress'
import type { Tone } from '../pinyin/marks'
import { localDate } from '../progress/streak'

export type LaunchBlockId = LaunchBlockState['id']
export const LAUNCH_ORDER: LaunchBlockId[] = ['warmup', 'review', 'new', 'echo', 'speak']

type Learned = { syllables: Syllable[]; toneChoices: Set<Tone>; spoken: Item[]; words: Item[] }

/** Что уже пройдено: слоги из «угадай тон», звуки из «повтори/послушай», слова. */
export function learnedMaterial(completed: Set<string>): Learned {
  const syllables = new Set<Syllable>()
  const toneChoices = new Set<Tone>()
  const spoken = new Set<Item>()
  const words = new Set<Item>()
  for (const l of lessonOrder) {
    if (!completed.has(l.id)) continue
    l.newWords.forEach((w) => words.add(w))
    for (const p of l.parts) {
      if (p.type === 'guessTone') {
        p.items.forEach((s) => syllables.add(s))
        p.choices.forEach((t) => toneChoices.add(t))
      }
      if (p.type === 'repeat' || p.type === 'read') p.items.forEach((i) => spoken.add(i))
      if (p.type === 'listen') p.series.flat().forEach((i) => spoken.add(i))
    }
  }
  return { syllables: [...syllables], toneChoices, spoken: [...spoken], words: [...words] }
}

/** Экраны синтетического блока (разминка, эхо, скажи сам) на сегодня. */
export function blockScreens(block: LaunchBlockId, learned: Learned, date: string): Screen[] {
  const seed = hash(`${date}:${block}`)
  switch (block) {
    case 'warmup': {
      const choices = [...learned.toneChoices].sort() as Tone[]
      // Тоны, которых ещё не было в уроках, не спрашиваем.
      const items = shuffle(
        learned.syllables.filter((s) => choices.includes(Number(s.slice(-1)) as Tone)),
        seed,
      ).slice(0, 12)
      return items.map((syl) => ({ kind: 'guessTone', syl, choices }))
    }
    case 'echo':
      return shuffle(learned.spoken, seed)
        .slice(0, 8)
        .map((item) => ({ kind: 'repeat', item }))
    case 'speak': {
      const words = shuffle(learned.words, seed).slice(0, 4)
      const syl = shuffle(learned.spoken.filter((i) => !i.startsWith('w-')), seed + 1).slice(0, 4)
      return interleave([words.map((item) => ({ kind: 'read', item })), syl.map((item) => ({ kind: 'read', item }))])
    }
    default:
      return []
  }
}

/** План на сегодня: какие блоки есть, какие пропускаются. */
export function planLaunch(completed: Set<string>, date: string): LaunchBlockState[] {
  const learned = learnedMaterial(completed)
  const next = nextLessonId(completed)
  const games = gameMaterial(completed)
  return LAUNCH_ORDER.map((id): LaunchBlockState => {
    if (id === 'review') return { id, status: 'skipped', auto: true }
    // Разминка — раунд «Тон-тира» по пройденным тонам.
    if (id === 'warmup') return gameAvailable('shooter', games) ? { id, status: 'pending' } : { id, status: 'skipped', auto: true }
    if (id === 'new') return next ? { id, status: 'pending', lessonId: next } : { id, status: 'skipped', auto: true }
    return blockScreens(id, learned, date).length ? { id, status: 'pending' } : { id, status: 'skipped', auto: true }
  })
}

/**
  Обновить план в течение дня: если урок пройден с карты, «Новое» указывает на следующий,
  а блоки, пропущенные из-за отсутствия материала, открываются. Сделанное и пропущенное
  пользователем не трогаем.
*/
export function refreshPlan(blocks: LaunchBlockState[], fresh: LaunchBlockState[]): LaunchBlockState[] {
  return blocks.map((b) => {
    const f = fresh.find((x) => x.id === b.id)!
    if (b.status === 'done' || (b.status === 'skipped' && !b.auto)) return b
    return f
  })
}

/** Загрузить или создать сегодняшний пуск. */
export async function getTodayLaunch(): Promise<LaunchRow> {
  const date = localDate()
  const existing = await db.launches.get(date)
  const fresh = planLaunch(await completedLessonIds(), date)
  if (existing) {
    const blocks = refreshPlan(existing.blocks, fresh)
    if (JSON.stringify(blocks) !== JSON.stringify(existing.blocks)) {
      const finished = blocks.every((b) => b.status !== 'pending')
      const row = { ...existing, blocks, finishedAt: finished ? (existing.finishedAt ?? Date.now()) : undefined }
      await db.launches.put(row)
      return row
    }
    return existing
  }
  const row: LaunchRow = {
    date,
    blocks: fresh,
    startedAt: Date.now(),
    seconds: 0,
    dv: 0,
    correct: 0,
    total: 0,
  }
  await db.launches.put(row)
  return row
}

export async function finishBlock(
  block: LaunchBlockId,
  r: { seconds: number; dv: number; correct: number; total: number },
): Promise<void> {
  const date = localDate()
  await db.transaction('rw', db.launches, async () => {
    const row = await db.launches.get(date)
    if (!row) return
    row.blocks = row.blocks.map((b) => (b.id === block ? { ...b, status: 'done' } : b))
    row.seconds += Math.round(r.seconds)
    row.dv += r.dv
    row.correct += r.correct
    row.total += r.total
    if (row.blocks.every((b) => b.status !== 'pending')) row.finishedAt = Date.now()
    await db.launches.put(row)
  })
}

export async function skipBlock(block: LaunchBlockId): Promise<void> {
  const date = localDate()
  const row = await db.launches.get(date)
  if (!row) return
  row.blocks = row.blocks.map((b) => (b.id === block && b.status === 'pending' ? { ...b, status: 'skipped', auto: false } : b))
  if (row.blocks.every((b) => b.status !== 'pending')) row.finishedAt = Date.now()
  await db.launches.put(row)
}

export function lessonTitle(id?: string): string | undefined {
  return id ? lessonById.get(id)?.title : undefined
}
