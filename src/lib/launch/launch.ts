/*
  Ежедневный «пуск» (ТЗ §5.1, фаза 2). Блоки по времени — из planSession (разминка 3, повторение 10,
  новое 12, эхо 10, скажи сам 5 при 40 минутах). Чтобы не было скучно, блоки режутся на сегменты
  не длиннее ~3 минут одного формата и чередуются: разминка → повторение → новое → эхо → повторение →
  скажи сам → эхо → … Новый урок — один сегмент: формат в нём меняется сам (не больше 3 экранов подряд).
  Блоки без материала пропускаются.
*/
import { lessonById, lessonOrder, sentenceById, wordById } from '../../content'
import type { Item } from '../../content/types'
import { db } from '../db/db'
import type { CardRow, LaunchRow, LaunchSegment } from '../db/types'
import { gameAvailable, gameMaterial, type GameId } from '../games/games'
import { hash, patternOptions, shuffle, type Screen } from '../lesson/build'
import { completedLessonIds, nextLessonId } from '../lesson/progress'
import { localDate } from '../progress/streak'
import { planSession, type BlockId } from '../session/plan'
import { ensureCardsForCompleted, mixKinds, reviewQueue, DUE_OVERLOAD } from '../srs/cards'

export type LaunchBlockId = BlockId
export const MAX_SEGMENT_MINUTES = 3

/** Сколько секунд в среднем уходит на экран каждого формата. */
export const SECONDS_PER = { cards: 15, echo: 18, speak: 22 } as const

type Learned = { spoken: Item[]; words: Item[]; sentences: Item[] }

/** Пройденный материал для эха и «скажи сам». */
export function learnedMaterial(completed: Set<string>): Learned {
  const spoken = new Set<Item>()
  const words = new Set<Item>()
  const sentences = new Set<Item>()
  for (const l of lessonOrder) {
    if (!completed.has(l.id)) continue
    l.newWords.forEach((w) => words.add(w))
    for (const p of l.parts) {
      if (p.type === 'repeat' || p.type === 'read') p.items.forEach((i) => spoken.add(i))
      if (p.type === 'listen') p.series.flat().forEach((i) => spoken.add(i))
      if (p.type === 'sentences' || p.type === 'assemble') p.items.forEach((i) => sentences.add(i))
      if (p.type === 'explain') p.sentences?.forEach((i) => sentences.add(i))
    }
  }
  return {
    spoken: [...spoken].filter((i) => !i.startsWith('s-') || sentenceById.has(i)),
    words: [...words].filter((w) => wordById.has(w)),
    sentences: [...sentences].filter((s) => sentenceById.has(s)),
  }
}

/** Игра для разминки: по кругу из доступных, чтобы не приедалась. */
export function warmupGame(completed: Set<string>, date: string): GameId | null {
  const m = gameMaterial(completed)
  const all: GameId[] = ['shooter', 'speed', 'pingpong', 'twins', 'assemble']
  const open = all.filter((g) => gameAvailable(g, m))
  if (!open.length) return null
  return open[hash(date) % open.length]!
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export type PlanInput = {
  minutes: number
  completed: Set<string>
  /** очередь карточек (самые срочные первыми) */
  due: CardRow[]
  date: string
}

/** План на день: сегменты в порядке прохождения. */
export function planSegments(input: PlanInput): LaunchSegment[] {
  const { completed, date } = input
  const plan = planSession(input.minutes)
  const min = Object.fromEntries(plan.map((b) => [b.id, b.minutes])) as Record<BlockId, number>
  const seed = hash(date)
  const learned = learnedMaterial(completed)

  // Разминка
  const game = warmupGame(completed, date)
  const warmup: LaunchSegment[] = game
    ? [{ id: 'warmup', block: 'warmup', kind: 'game', game, minutes: min.warmup, status: 'pending' }]
    : []

  // Повторение: по времени, куски ≤ 3 минут
  const perChunk = Math.floor((MAX_SEGMENT_MINUTES * 60) / SECONDS_PER.cards)
  const cardCount = Math.min(input.due.length, Math.round((min.review * 60) / SECONDS_PER.cards))
  const review = chunk(input.due.slice(0, cardCount), perChunk).map((part) => mixKinds(part).map((c) => c.id)).map(
    (items, i): LaunchSegment => ({
      id: `review-${i + 1}`,
      block: 'review',
      kind: 'cards',
      items,
      minutes: Math.max(1, Math.round((items.length * SECONDS_PER.cards) / 60)),
      status: 'pending',
    }),
  )

  // Новое
  const next = nextLessonId(completed)
  const fresh: LaunchSegment[] = next
    ? [{ id: 'new', block: 'new', kind: 'lesson', lessonId: next, minutes: min.new, status: 'pending' }]
    : []

  // Эхо: фразы, пока их нет — слова и слоги
  const echoPool = learned.sentences.length >= 4 ? learned.sentences : learned.spoken
  const echoCount = Math.min(echoPool.length, Math.round((min.echo * 60) / SECONDS_PER.echo))
  const echo = chunk(shuffle(echoPool, seed).slice(0, echoCount), Math.floor((MAX_SEGMENT_MINUTES * 60) / SECONDS_PER.echo)).map(
    (items, i): LaunchSegment => ({
      id: `echo-${i + 1}`,
      block: 'echo',
      kind: 'echo',
      items,
      minutes: Math.max(1, Math.round((items.length * SECONDS_PER.echo) / 60)),
      status: 'pending',
    }),
  )

  // Скажи сам: слова и фразы по-русски → вслух по-китайски
  const speakPool = [...learned.words, ...learned.sentences]
  const speakCount = Math.min(speakPool.length, Math.round((min.speak * 60) / SECONDS_PER.speak))
  const speak = chunk(shuffle(speakPool, seed + 1).slice(0, speakCount), Math.floor((MAX_SEGMENT_MINUTES * 60) / SECONDS_PER.speak)).map(
    (items, i): LaunchSegment => ({
      id: `speak-${i + 1}`,
      block: 'speak',
      kind: 'speak',
      items,
      minutes: Math.max(1, Math.round((items.length * SECONDS_PER.speak) / 60)),
      status: 'pending',
    }),
  )

  // Чередование: разминка, первый кусок повторения, новое, дальше по кругу повторение/эхо/скажи сам.
  const out: LaunchSegment[] = [...warmup]
  if (review.length) out.push(review.shift()!)
  out.push(...fresh)
  const queues = [review, echo, speak].filter((q) => q.length)
  // После «нового» сначала эхо — повторить вслух только что услышанное.
  queues.sort((a, b) => (a[0]!.kind === 'echo' ? -1 : b[0]!.kind === 'echo' ? 1 : 0))
  let k = 0
  while (queues.some((q) => q.length)) {
    const last = out[out.length - 1]?.kind
    let tries = 0
    while (tries < queues.length && (!queues[k % queues.length]!.length || queues[k % queues.length]![0]!.kind === last)) {
      k++
      tries++
    }
    const q = queues[k % queues.length]!.length ? queues[k % queues.length]! : queues.find((x) => x.length)!
    out.push(q.shift()!)
    k++
  }
  return out
}

/** Экраны сегмента (детерминированно — можно выйти и продолжить). */
export function segmentScreens(seg: LaunchSegment, date: string, cards?: Map<string, CardRow>): Screen[] {
  const seed = hash(`${date}:${seg.id}`)
  const items = seg.items ?? []
  switch (seg.kind) {
    case 'cards':
      return items.flatMap((id, i): Screen[] => {
        const c = cards?.get(id)
        const [word, kindStr] = [id.slice(0, id.lastIndexOf(':')), id.slice(id.lastIndexOf(':') + 1)]
        const cardKind = Number(c?.kind ?? kindStr) as 1 | 2 | 3 | 4
        if (!wordById.has(word) || cardKind > 4) return []
        return [{ kind: 'card', cardId: id, word, cardKind, options: cardKind === 4 ? patternOptions(word, seed + i) : undefined }]
      })
    case 'echo':
      return items.map((item) => ({ kind: 'repeat', item }))
    case 'speak':
      return items.map((item) => ({ kind: 'sayIt', item }))
    default:
      return []
  }
}

/** Загрузить или создать сегодняшний пуск; план обновляется, пока блок не начат. */
export async function getTodayLaunch(minutes: number): Promise<LaunchRow & { segments: LaunchSegment[] }> {
  const date = localDate()
  // Сначала — карточки для уже пройденных уроков, иначе план соберётся без повторения.
  await ensureCardsForCompleted()
  const completed = await completedLessonIds()
  const queue = await reviewQueue(Math.round((60 * 60) / SECONDS_PER.cards))
  const fresh = planSegments({ minutes, completed, due: [...queue.cards].sort((a, b) => a.due - b.due), date })
  const existing = await db.launches.get(date)
  if (existing?.segments) {
    const segments = refreshSegments(existing.segments, fresh)
    const row = { ...existing, segments, totalDue: queue.totalDue }
    if (JSON.stringify(segments) !== JSON.stringify(existing.segments)) await db.launches.put(row)
    return row
  }
  const row: LaunchRow & { segments: LaunchSegment[] } = {
    date,
    blocks: [],
    segments: fresh,
    totalDue: queue.totalDue,
    startedAt: Date.now(),
    seconds: 0,
    dv: 0,
    correct: 0,
    total: 0,
  }
  await db.launches.put(row)
  return row
}

/**
  Обновить план в течение дня: блоки, где ещё ничего не сделано и не пропущено вручную,
  берутся из свежего плана (например, урок пройден с карты — «Новое» указывает на следующий).
*/
export function refreshSegments(old: LaunchSegment[], fresh: LaunchSegment[]): LaunchSegment[] {
  const touched = new Set(old.filter((s) => s.status === 'done' || (s.status === 'skipped' && !s.auto)).map((s) => s.block))
  const keep = old.filter((s) => touched.has(s.block))
  const add = fresh.filter((s) => !touched.has(s.block))
  // Порядок — как в свежем плане, сделанное остаётся на своих местах в начале.
  const done = keep.filter((s) => s.status !== 'pending')
  const pending = [...keep.filter((s) => s.status === 'pending'), ...add]
  const order = new Map(fresh.map((s, i) => [s.id, i]))
  pending.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
  return [...done, ...pending]
}

export async function finishSegment(
  segId: string,
  r: { seconds: number; dv: number; correct: number; total: number },
): Promise<void> {
  const date = localDate()
  await db.transaction('rw', db.launches, async () => {
    const row = await db.launches.get(date)
    if (!row?.segments) return
    row.segments = row.segments.map((s) => (s.id === segId ? { ...s, status: 'done' } : s))
    row.seconds += Math.round(r.seconds)
    row.dv += r.dv
    row.correct += r.correct
    row.total += r.total
    if (row.segments.every((s) => s.status !== 'pending')) row.finishedAt = Date.now()
    await db.launches.put(row)
  })
}

/** Пропустить весь блок (все его сегменты). */
export async function skipBlock(block: BlockId): Promise<void> {
  const date = localDate()
  const row = await db.launches.get(date)
  if (!row?.segments) return
  row.segments = row.segments.map((s) => (s.block === block && s.status === 'pending' ? { ...s, status: 'skipped', auto: false } : s))
  if (row.segments.every((s) => s.status !== 'pending')) row.finishedAt = Date.now()
  await db.launches.put(row)
}

/** Куда вести сегмент. */
export function segmentUrl(seg: LaunchSegment): string {
  if (seg.kind === 'lesson' && seg.lessonId) return `/lesson/${seg.lessonId}?from=launch&seg=${seg.id}`
  if (seg.kind === 'game' && seg.game) return `/game/${seg.game}?from=launch&seg=${seg.id}`
  return `/launch/${seg.id}`
}

export function lessonTitle(id?: string): string | undefined {
  return id ? lessonById.get(id)?.title : undefined
}

export { DUE_OVERLOAD }
