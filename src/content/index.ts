/*
  Учебный контент и быстрые индексы по нему. Ступени и сюжет лежат в отдельных файлах (data.ts),
  которые грузятся один раз до первого рендера — loadContent() в main.tsx (в тестах — setup).
  Индексы заполняются на месте, поэтому импортировать их можно как раньше: они пусты только до загрузки.
*/
import type { Character, Content, Dialogue, Episode, Lesson, Sentence, Unit, Word } from './types'

export const content: Content = { units: [], lessons: [], words: [], sentences: [], dialogues: [], characters: [], episodes: [] }

export const units: Unit[] = []
export const unitById = new Map<string, Unit>()
export const lessonById = new Map<string, Lesson>()
export const wordById = new Map<string, Word>()
export const sentenceById = new Map<string, Sentence>()
export const dialogueById = new Map<string, Dialogue>()
export const characterById = new Map<string, Character>()
export const episodes: Episode[] = []
/** Все уроки курса по порядку прохождения (сюжет сюда не входит — он в «Командировке»). */
export const lessonOrder: Lesson[] = []
/** Этап, в котором слово вводится впервые. */
export const unitOfWord = new Map<string, string>()

let loading: Promise<void> | null = null

/** Загрузить данные курса (отдельный кусок бандла) и заполнить индексы. Повторный вызов — та же загрузка. */
export function loadContent(): Promise<void> {
  loading ??= import('./data').then(({ raw }) => fill(raw))
  return loading
}

export function fill(raw: Content): void {
  Object.assign(content, raw)
  for (const m of [unitById, lessonById, wordById, sentenceById, dialogueById, characterById, unitOfWord]) m.clear()
  units.splice(0, units.length, ...[...raw.units].sort((a, b) => a.stage - b.stage || a.order - b.order))
  for (const u of raw.units) unitById.set(u.id, u)
  for (const l of raw.lessons) lessonById.set(l.id, l)
  for (const w of raw.words) wordById.set(w.id, w)
  for (const s of raw.sentences) sentenceById.set(s.id, s)
  for (const d of raw.dialogues) dialogueById.set(d.id, d)
  for (const c of raw.characters ?? []) characterById.set(c.id, c)
  episodes.splice(0, episodes.length, ...[...(raw.episodes ?? [])].sort((a, b) => a.n - b.n))
  lessonOrder.splice(0, lessonOrder.length, ...units.flatMap((u) => u.lessons.map((id) => lessonById.get(id)!).filter(Boolean)))
  for (const u of units) for (const l of u.lessons) for (const w of lessonById.get(l)?.newWords ?? []) if (!unitOfWord.has(w)) unitOfWord.set(w, u.id)
}

export function unitsOfStage(stage: number): Unit[] {
  return units.filter((u) => u.stage === stage)
}

/** Текст фразы для звука и отображения: «你好，我叫王明。» */
export function sentenceText(s: Sentence): string {
  return s.tokens.map((t) => t.hanzi).join('')
}

/** Пиньинь фразы цифрами — без знаков препинания. */
export function sentencePinyin(s: Sentence): string {
  return s.tokens
    .filter((t) => t.pinyin)
    .map((t) => t.pinyin)
    .join(' ')
}

/** Знак препинания — токен без пиньиня. */
export function isPunct(t: { pinyin: string }): boolean {
  return !t.pinyin.trim()
}
