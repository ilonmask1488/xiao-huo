/* Учебный контент и быстрые индексы по нему. Ступени и сюжет лежат в отдельных файлах и склеиваются здесь. */
import charactersJson from './characters.json'
import dialoguesJson from './dialogues.json'
import lessonsJson from './lessons.json'
import sentencesJson from './sentences.json'
import s1Dialogues from './stage1/dialogues.json'
import s1Lessons from './stage1/lessons.json'
import s1Sentences from './stage1/sentences.json'
import s1Units from './stage1/units.json'
import s1Words from './stage1/words.json'
import s2Dialogues from './stage2/dialogues.json'
import s2Lessons from './stage2/lessons.json'
import s2Sentences from './stage2/sentences.json'
import s2Units from './stage2/units.json'
import s2Words from './stage2/words.json'
import storyDialogues from './story/dialogues.json'
import storyEpisodes from './story/episodes.json'
import storyLessons from './story/lessons.json'
import storySentences from './story/sentences.json'
import storyWords from './story/words.json'
import type { Character, Content, Dialogue, Episode, Lesson, Sentence, Unit, Word } from './types'
import unitsJson from './units.json'
import wordsJson from './words.json'

export const content: Content = {
  units: [...unitsJson, ...s1Units, ...s2Units] as Unit[],
  lessons: [...lessonsJson, ...s1Lessons, ...s2Lessons, ...storyLessons] as Lesson[],
  words: [...wordsJson, ...s1Words, ...storyWords, ...s2Words] as Word[],
  sentences: [...sentencesJson, ...s1Sentences, ...storySentences, ...s2Sentences] as Sentence[],
  dialogues: [...dialoguesJson, ...s1Dialogues, ...s2Dialogues, ...storyDialogues] as Dialogue[],
  characters: charactersJson as Character[],
  episodes: storyEpisodes as Episode[],
}

export const units = [...content.units].sort((a, b) => a.stage - b.stage || a.order - b.order)
export const unitById = new Map(content.units.map((u) => [u.id, u]))
export const lessonById = new Map(content.lessons.map((l) => [l.id, l]))
export const wordById = new Map(content.words.map((w) => [w.id, w]))
export const sentenceById = new Map(content.sentences.map((s) => [s.id, s]))
export const dialogueById = new Map(content.dialogues.map((d) => [d.id, d]))
export const characterById = new Map((content.characters ?? []).map((c) => [c.id, c]))
export const episodes = [...(content.episodes ?? [])].sort((a, b) => a.n - b.n)

/** Все уроки курса по порядку прохождения (сюжет сюда не входит — он в «Командировке»). */
export const lessonOrder: Lesson[] = units.flatMap((u) => u.lessons.map((id) => lessonById.get(id)!).filter(Boolean))

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

/** Этап, в котором слово вводится впервые. */
export const unitOfWord = new Map<string, string>()
for (const u of units) for (const l of u.lessons) for (const w of lessonById.get(l)?.newWords ?? []) if (!unitOfWord.has(w)) unitOfWord.set(w, u.id)
