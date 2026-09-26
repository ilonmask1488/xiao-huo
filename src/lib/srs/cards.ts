/*
  Карточки в базе: создание, очередь на повторение, ответ.
*/
import { lessonById, lessonOrder, wordById } from '../../content'
import { db, type AppDB } from '../db/db'
import type { CardRow } from '../db/types'
import { cardId, newCard, review, unlocksAfter, type CardKind, type Grade14 } from './srs'

/** Больше этого — не заваливаем, а берём самые срочные и честно говорим об этом. */
export const DUE_OVERLOAD = 150
/** Открытые позже типы карточек появляются не сразу, а к следующему занятию. */
const UNLOCK_DELAY_MS = 12 * 60 * 60 * 1000

/** Карточки типа 1 для слов урока (идемпотентно). */
export async function ensureCardsForLesson(lessonId: string, database: AppDB = db, now = Date.now()): Promise<number> {
  const lesson = lessonById.get(lessonId)
  if (!lesson) return 0
  const ids = lesson.newWords.filter((w) => wordById.has(w))
  if (!ids.length) return 0
  let created = 0
  await database.transaction('rw', database.cards, async () => {
    for (const w of ids) {
      const id = cardId(w, 1)
      if (!(await database.cards.get(id))) {
        await database.cards.put(newCard(w, 1, now))
        created++
      }
    }
  })
  return created
}

/** Для всех пройденных уроков (при запуске и после восстановления бэкапа). */
export async function ensureCardsForCompleted(database: AppDB = db): Promise<void> {
  const done = await database.lessonProgress.filter((p) => !!p.completedAt).toArray()
  const ids = new Set(done.map((p) => p.lessonId))
  for (const l of lessonOrder) if (ids.has(l.id)) await ensureCardsForLesson(l.id, database)
}

export type ReviewQueue = { cards: CardRow[]; totalDue: number; capped: boolean }

/**
  Очередь на сегодня: сначала самые просроченные, типы вперемешку (не больше 3 одного типа подряд).
  Карточки уже выученных, но ещё не наступивших по сроку, не берём.
*/
export async function reviewQueue(limit: number, database: AppDB = db, now = Date.now()): Promise<ReviewQueue> {
  const due = await database.cards.where('due').belowOrEqual(now).toArray()
  // Слова, которых больше нет в контенте, пропускаем.
  const live = due.filter((c) => wordById.has(c.itemId)).sort((a, b) => a.due - b.due)
  const picked = live.slice(0, limit)
  return { cards: mixKinds(picked), totalDue: live.length, capped: live.length > limit }
}

/** Перемешать по типам: не больше 3 карточек одного типа подряд, где это возможно. */
export function mixKinds(cards: CardRow[]): CardRow[] {
  const queues = new Map<number, CardRow[]>()
  for (const c of cards) queues.set(c.kind, [...(queues.get(c.kind) ?? []), c])
  const out: CardRow[] = []
  let last = -1
  let run = 0
  while (out.length < cards.length) {
    const options = [...queues.entries()].filter(([, q]) => q.length).sort((a, b) => b[1].length - a[1].length)
    const pick = options.find(([k]) => k !== last || run < 3) ?? options[0]!
    const c = pick[1].shift()!
    run = c.kind === last ? run + 1 : 1
    last = c.kind
    out.push(c)
  }
  return out
}

/** Ответ: обновить карточку, записать в журнал, открыть следующие типы. */
export async function answerCard(
  id: string,
  grade: Grade14,
  durationMs: number,
  retention: number,
  database: AppDB = db,
  now = Date.now(),
): Promise<CardKind[]> {
  const opened: CardKind[] = []
  await database.transaction('rw', database.cards, database.reviews, async () => {
    const row = await database.cards.get(id)
    if (!row) return
    const next = review(row, grade, now, retention)
    await database.cards.put(next)
    await database.reviews.add({ cardId: id, at: now, rating: grade, durationMs, stateBefore: row.state, kind: row.kind })
    for (const kind of unlocksAfter(row, grade)) {
      const nid = cardId(row.itemId, kind)
      if (await database.cards.get(nid)) continue
      const card = newCard(row.itemId, kind, now)
      await database.cards.put({ ...card, due: now + UNLOCK_DELAY_MS })
      opened.push(kind)
    }
  })
  return opened
}

/** Удержание: доля «вспомнил» среди повторений карточек в состоянии «повторение» (не новых). */
export async function retentionStats(database: AppDB = db, sinceMs = 30 * 24 * 60 * 60 * 1000, now = Date.now()) {
  const logs = await database.reviews.where('at').above(now - sinceMs).toArray()
  const mature = logs.filter((l) => l.stateBefore === 2)
  const ok = mature.filter((l) => l.rating >= 2).length
  return { reviews: logs.length, mature: mature.length, retention: mature.length ? ok / mature.length : null }
}

/** Сколько слов «в работе» (есть хотя бы одна карточка). */
export async function learnedWordIds(database: AppDB = db): Promise<Set<string>> {
  const cards = await database.cards.where('kind').equals(1).toArray()
  return new Set(cards.map((c) => c.itemId))
}
