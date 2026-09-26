/*
  Урок = последовательность коротких экранов. Части урока (LessonPart) разворачиваются в экраны,
  а между объяснениями экраны перемешиваются так, чтобы одного типа шло не больше 3 подряд.
*/
import { content, dialogueById, isPunct, sentenceById, unitOfWord, units, wordById } from '../../content'
import type { Contrast, Item, Lesson, LessonPart, SentenceId, Syllable, WordId } from '../../content/types'
import type { Tone } from '../pinyin/marks'
import { tonesOf } from '../pinyin/normalize'
import { meaningOf } from '../words'

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
  | { kind: 'meaning'; word: WordId; prompt: 'audio' | 'text'; options: WordId[] }
  | { kind: 'sentence'; id: SentenceId }
  | { kind: 'assemble'; id: SentenceId; order: number[] }
  | { kind: 'sayIt'; item: Item }
  /** карточка повторения FSRS */
  | { kind: 'card'; cardId: string; word: WordId; cardKind: 1 | 2 | 3 | 4 | 5; options?: string[] }
  /** реплика персонажа в диалоге (или твоя — без выбора) */
  | { kind: 'line'; dialogueId: string; index: number; speaker: string; sentenceId: SentenceId }
  /** твой ответ в диалоге: выбрать верную реплику, потом сказать вслух */
  | { kind: 'reply'; dialogueId: string; index: number; sentenceId: SentenceId; options: SentenceId[] }

export type ScreenKind = Screen['kind']

/** Экраны с правильным ответом — из них считается точность. */
export function isQuestion(s: Screen): boolean {
  return (
    s.kind === 'guessTone' ||
    s.kind === 'whichSyllable' ||
    s.kind === 'guessPair' ||
    s.kind === 'meaning' ||
    s.kind === 'assemble' ||
    s.kind === 'card' ||
    s.kind === 'reply'
  )
}

/** Экраны, где пользователь говорит вслух. */
export function isSpoken(s: Screen): boolean {
  return (
    s.kind === 'repeat' ||
    s.kind === 'read' ||
    s.kind === 'sayIt' ||
    s.kind === 'assemble' ||
    s.kind === 'reply' ||
    (s.kind === 'card' && s.cardKind === 3)
  )
}

/** Формат экрана для правила «не больше 3 подряд»: у карточек формат зависит от типа. */
export function formatOf(s: Screen): string {
  return s.kind === 'card' ? `card${s.cardKind}` : s.kind
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
    case 'meaning':
      return part.items.map((word, i) => ({
        kind: 'meaning',
        word,
        prompt: part.prompt,
        options: meaningOptions(word, seed + i),
      }))
    case 'sentences':
      return part.items.map((id) => ({ kind: 'sentence', id }))
    case 'assemble':
      return part.items.map((id, i) => ({ kind: 'assemble', id, order: assembleOrder(id, seed + i) }))
    case 'sayIt':
      return part.items.map((item) => ({ kind: 'sayIt', item }))
    case 'dialogue':
      return dialogueScreens(part.id, seed)
  }
}

/** Диалог → экраны: реплики по порядку, на ответах «me» — выбор из верного и ловушек. */
export function dialogueScreens(id: string, seed = 1): Screen[] {
  const d = dialogueById.get(id)
  if (!d) return []
  return d.lines.map((l, index): Screen =>
    l.speaker === 'me' && l.choices?.length
      ? { kind: 'reply', dialogueId: id, index, sentenceId: l.sentenceId, options: shuffle([l.sentenceId, ...l.choices], seed + index) }
      : { kind: 'line', dialogueId: id, index, speaker: l.speaker, sentenceId: l.sentenceId },
  )
}

/* ——— Варианты ответов ——— */

/** Правильное слово + 3 других с непохожим переводом — из того же и предыдущих этапов. */
export function meaningOptions(word: WordId, seed: number): WordId[] {
  const w = wordById.get(word)
  if (!w) return [word]
  const myUnit = unitOfWord.get(word)
  const order = units.map((u) => u.id)
  const limit = myUnit ? order.indexOf(myUnit) : order.length
  const pool = content.words.filter((x) => {
    if (x.id === word || meaningOf(x) === meaningOf(w)) return false
    const u = unitOfWord.get(x.id)
    return u !== undefined && order.indexOf(u) <= limit
  })
  // Сначала слова того же этапа — они похожи по теме и потому полезнее как ловушки.
  const same = shuffle(pool.filter((x) => unitOfWord.get(x.id) === myUnit), seed)
  const rest = shuffle(pool.filter((x) => unitOfWord.get(x.id) !== myUnit), seed + 1)
  const picked = [...same, ...rest].slice(0, 3).map((x) => x.id)
  return shuffle([word, ...picked], seed + 2)
}

/** Перемешанный порядок слов фразы (знаки препинания не участвуют и стоят на месте). */
export function assembleOrder(id: SentenceId, seed: number): number[] {
  const s = sentenceById.get(id)
  if (!s) return []
  const idx = s.tokens.map((_, i) => i).filter((i) => !isPunct(s.tokens[i]!))
  if (idx.length < 2) return idx
  // Перемешиваем, пока порядок не отличается от правильного.
  for (let k = 0; k < 10; k++) {
    const sh = shuffle(idx, seed + k)
    if (sh.some((v, i) => v !== idx[i])) return sh
  }
  return [...idx].reverse()
}

/** Тоновый рисунок слова: «13», «3», «435». */
export function tonePattern(word: WordId): string {
  const w = wordById.get(word)
  if (!w) throw new Error(`нет слова ${word}`)
  return tonesOf(w.pinyin).join('')
}

/** Для карточки «тоны»: верный рисунок + 3 отличающихся одним слогом. */
export function patternOptions(word: WordId, seed: number): string[] {
  const right = tonePattern(word)
  const near = new Set<string>()
  for (let i = 0; i < right.length; i++) {
    const allowed = i === 0 ? '1234' : '12345'
    for (const t of allowed) if (t !== right[i]) near.add(right.slice(0, i) + t + right.slice(i + 1))
  }
  return shuffle([right, ...shuffle([...near], seed).slice(0, 3)], seed + 7)
}

/**
  Слияние частей одного раздела (между объяснениями). Идём в порядке авторства:
  продолжаем текущую часть кусками до 3 экранов, потом берём первую подходящую —
  но только если остаток после этого ещё можно разложить без 4 одинаковых подряд.
*/
export function interleave(queues: Screen[][]): Screen[] {
  const qs = queues.map((q) => [...q]).filter((q) => q.length)
  const counts = new Map<string, number>()
  for (const q of qs) for (const s of q) counts.set(formatOf(s), (counts.get(formatOf(s)) ?? 0) + 1)

  const feasible = (last: string, run: number): boolean => {
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
    const lastScreen = out[out.length - 1]
    const last = lastScreen ? formatOf(lastScreen) : undefined
    const allowed = (i: number) => qs[i]!.length > 0 && (formatOf(qs[i]![0]!) !== last || run < MAX_RUN)
    const order = [current, ...qs.keys()].filter((i, n, a) => a.indexOf(i) === n && allowed(i))
    const works = (i: number) => {
      const kind = formatOf(qs[i]![0]!)
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
    counts.set(formatOf(s), counts.get(formatOf(s))! - 1)
    run = formatOf(s) === last ? run + 1 : 1
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
    // Объяснение и диалог — отдельные разделы: их экраны идут строго по порядку.
    if (part.type === 'explain' || part.type === 'dialogue') {
      flush()
      out.push(...expandPart(part, seed + i * 31))
    } else section.push(expandPart(part, seed + i * 31))
  })
  flush()
  return out
}

/** Наибольшая длина серии одинаковых экранов (для проверки контента). */
export function longestRun(screens: Screen[], ignore: ScreenKind[] = ['explain']): number {
  let best = 0
  let run = 0
  let last: string | null = null
  for (const s of screens) {
    run = formatOf(s) === last ? run + 1 : 1
    last = formatOf(s)
    if (!ignore.includes(s.kind)) best = Math.max(best, run)
  }
  return best
}

/** Все звуки урока — для предзагрузки. */
export function itemsOf(screen: Screen): Item[] {
  switch (screen.kind) {
    case 'explain':
      return [
        ...(screen.part.examples?.map((e) => e.syl) ?? []),
        ...(screen.part.words ?? []),
        ...(screen.part.sentences ?? []),
      ]
    case 'listen':
      return screen.series
    case 'repeat':
    case 'read':
    case 'sayIt':
      return [screen.item]
    case 'guessTone':
      return [screen.syl, ...screen.choices.filter((t) => t !== 5).map((t) => `${screen.syl.slice(0, -1)}${t}`)]
    case 'whichSyllable':
      return screen.options
    case 'guessPair':
    case 'card':
      return [screen.word]
    case 'meaning':
      return [screen.word]
    case 'sentence':
    case 'assemble':
      return [screen.id]
    case 'line':
    case 'reply':
      return [screen.sentenceId]
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
