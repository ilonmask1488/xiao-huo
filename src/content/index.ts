/* Учебный контент и быстрые индексы по нему. */
import dialoguesJson from './dialogues.json'
import lessonsJson from './lessons.json'
import sentencesJson from './sentences.json'
import type { Content, Dialogue, Lesson, Sentence, Unit, Word } from './types'
import unitsJson from './units.json'
import wordsJson from './words.json'

export const content: Content = {
  units: unitsJson as Unit[],
  lessons: lessonsJson as Lesson[],
  words: wordsJson as Word[],
  sentences: sentencesJson as Sentence[],
  dialogues: dialoguesJson as Dialogue[],
}

export const units = [...content.units].sort((a, b) => a.stage - b.stage || a.order - b.order)
export const unitById = new Map(content.units.map((u) => [u.id, u]))
export const lessonById = new Map(content.lessons.map((l) => [l.id, l]))
export const wordById = new Map(content.words.map((w) => [w.id, w]))

/** Все уроки курса по порядку прохождения. */
export const lessonOrder: Lesson[] = units.flatMap((u) => u.lessons.map((id) => lessonById.get(id)!).filter(Boolean))

export function unitsOfStage(stage: number): Unit[] {
  return units.filter((u) => u.stage === stage)
}
