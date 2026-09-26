/*
  Урок = последовательность коротких экранов. Части урока (LessonPart) разворачиваются в экраны,
  а между объяснениями экраны перемешиваются так, чтобы одного типа шло не больше 3 подряд.
*/
import { wordById } from '../../content'
import type { Contrast, Item, Lesson, LessonPart, Syllable, WordId } from '../../content/types'
import type { Tone } from '../pinyin/marks'
import { tonesOf } from '../pinyin/normalize'

export const MAX_RUN = 3

export type ExplainPart = Extract<LessonPart, { type: 'explain' }>

export type Screen =
  | { kind: 'explain'; part: ExplainPart }
  | { kind: 'listen'; title?: string; series: Item[] }
  | { kind: 'repeat'; item: Item }
  | { kind: 'guessTone'; syl: Syllable; choices: Tone[] }
  | { kind: 'whichSyllable'; answer: Syllable; options: Syllable[]; contrast: Contrast }
  | { kind: 'guessPair'; word: WordId; options: string[] }
  | { kind: 'read'; item: Item }

export type ScreenKind = Screen['kind']

/** Экраны с правильным ответом — из них считается точность. */
export function isQuestion(s: Screen): boolean {
  return s.kind === 'guessTone' || s.kind === 'whichSyllable' || s.kind === 'guessPair'
}

/** Экраны, где пользователь говорит вслух. */
export function isSpoken(s: Screen): boolean {
  return s.kind === 'repeat' || s.kind === 'read'
}

export function expandPart(part: LessonPart, seed = 1): Screen[] {
  switch (part.type) {
    case 'explain':
      return [{ kind: 'explain', part }]
    case 'listen':
      return part.series.map((series) => ({ kind: 'listen', title: part.title, series }))
    case 'repeat':
      return part.items.map((item) => ({ kind: 'repeat', item }))
    case 'read':
      return part.items.map((item) => ({ kind: 'read', item }))
    case 'guessTone':
      return part.items.map((syl) => ({ kind: 'guessTone', syl, choices: part.choices }))
    case 'whichSyllable':
      return part.items.map((it, i) => ({
        kind: 'whichSyllable',
        answer: it.answer,
        options: shuffle(it.options, seed + i),
        contrast: part.contrast,
      }))
    case 'guessPair':
      return part.items.map((word, i) => ({ kind: 'guessPair', word, options: pairOptions(word, seed + i) }))
  }
}

/**
  Слияние частей одного раздела (между объяснениями). Идём в порядке авторства:
  продолжаем текущую часть кусками до 3 экранов, потом берём первую подходящую —
  но только если остаток после этого ещё можно разложить без 4 одинаковых подряд.
*/
export function interleave(queues: Screen[][]): Screen[] {
  const qs = queues.map((q) => [...q]).filter((q) => q.length)
  const counts = new Map<ScreenKind, number>()
  for (const q of qs) for (const s of q) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1)

  const feasible = (last: ScreenKind, run: number): boolean => {
    let total = 0
    for (const c of counts.values()) total += c
    for (const [k, c] of counts) {
      const cap = MAX_RUN * (total - c + 1) - (k === last ? run : 0)
      if (c > cap) return false
    }
    return true
  }

  const out: Screen[] = []
  let current = 0
  let run = 0
  while (qs.some((q) => q.length)) {
    const last = out[out.length - 1]?.kind
    const allowed = (i: number) => qs[i]!.length > 0 && (qs[i]![0]!.kind !== last || run < MAX_RUN)
    const order = [current, ...qs.keys()].filter((i, n, a) => a.indexOf(i) === n && allowed(i))
    const works = (i: number) => {
      const kind = qs[i]![0]!.kind
      counts.set(kind, counts.get(kind)! - 1)
      const ok = feasible(kind, kind === last ? run + 1 : 1)
      counts.set(kind, counts.get(kind)! + 1)
      return ok
    }
    let pick = order.find(works)
    if (pick === undefined) {
      // Разложить без нарушения нельзя — берём самую длинную; проверка контента это поймает.
      const pool = order.length ? order : [...qs.keys()].filter((i) => qs[i]!.length)
      pick = pool.reduce((a, b) => (qs[b]!.length > qs[a]!.length ? b : a))
    }
    const s = qs[pick]!.shift()!
    counts.set(s.kind, counts.get(s.kind)! - 1)
    run = s.kind === last ? run + 1 : 1
    out.push(s)
    current = pick
  }
  return out
}

export function buildLesson(lesson: Lesson): Screen[] {
  const seed = hash(lesson.id)
  const out: Screen[] = []
  let section: Screen[][] = []
  const flush = () => {
    out.push(...interleave(section))
    section = []
  }
  lesson.parts.forEach((part, i) => {
    if (part.type === 'explain') {
      flush()
      out.push(...expandPart(part))
    } else section.push(expandPart(part, seed + i * 31))
  })
  flush()
  return out
}

/** Наибольшая длина серии одинаковых экранов (для проверки контента). */
export function longestRun(screens: Screen[], ignore: ScreenKind[] = ['explain']): number {
  let best = 0
  let run = 0
  let last: ScreenKind | null = null
  for (const s of screens) {
    run = s.kind === last ? run + 1 : 1
    last = s.kind
    if (!ignore.includes(s.kind)) best = Math.max(best, run)
  }
  return best
}

/** Все звуки урока — для предзагрузки. */
export function itemsOf(screen: Screen): Item[] {
  switch (screen.kind) {
    case 'explain':
      return [...(screen.part.examples?.map((e) => e.syl) ?? []), ...(screen.part.words ?? [])]
    case 'listen':
      return screen.series
    case 'repeat':
    case 'read':
      return [screen.item]
    case 'guessTone':
      return [screen.syl, ...screen.choices.filter((t) => t !== 5).map((t) => `${screen.syl.slice(0, -1)}${t}`)]
    case 'whichSyllable':
      return screen.options
    case 'guessPair':
      return [screen.word]
  }
}

/* ——— Тоновые пары ——— */

export function pairOf(word: WordId): string {
  const w = wordById.get(word)
  if (!w) throw new Error(`нет слова ${word}`)
  return tonesOf(w.pinyin).join('')
}

/** Правильная пара + 3 отвлекающих: сначала «соседние» (отличаются одним тоном). */
export function pairOptions(word: WordId, seed: number): string[] {
  const right = pairOf(word)
  const [a, b] = [right[0]!, right[1]!]
  const near: string[] = []
  for (const t of '1234') if (t !== a) near.push(t + b)
  for (const t of '12345') if (t !== b) near.push(a + t)
  const picked = shuffle(near, seed).slice(0, 3)
  return shuffle([right, ...picked], seed + 7)
}

/* ——— Детерминированная случайность ——— */

export function hash(s: string): number {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

export function rng(seed: number): () => number {
  let x = seed || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 1_000_000) / 1_000_000
  }
}

export function shuffle<T>(arr: T[], seed: number): T[] {
  const r = rng(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
