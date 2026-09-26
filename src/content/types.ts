/* Модель учебного контента (ТЗ §9.1 + уроки ступени 0). Пиньинь хранится с цифрами: «gong1 cheng2 shi1», ü — v. */
/** 1–4 и 5 — нейтральный (тот же тип, что в lib/pinyin). */
export type Tone = 1 | 2 | 3 | 4 | 5

export type WordId = string // всегда начинается с «w-»
export type SentenceId = string
export type LessonId = string

/** Слог с тоном: «ma3», «lv4». Нейтральный — 5. */
export type Syllable = string

/** Что озвучить: слог («ma3»), слово (id «w-nihao») или фраза (id «s-…»). */
export type Item = Syllable | WordId | SentenceId

export type Word = {
  id: WordId
  hanzi: string
  pinyin: string // словарный
  pinyinSpoken?: string // если отличается из-за сандхи
  ru: string[]
  pos?: string
  hsk2?: 1 | 2 | 3 | 4 | 5 | 6
  hsk3?: number
  tags: string[]
  audio?: string
  example?: SentenceId
  mnemonic?: string
  note?: string
  reviewed: boolean
}

export type Token = { hanzi: string; pinyin: string; wordId?: WordId; ru?: string }

export type Sentence = {
  id: SentenceId // всегда начинается с «s-»
  tokens: Token[] // явная разбивка на слова — не сегментировать на лету
  ru: string
  literal?: string
  /** звук берётся из public/audio/manifest.json по тексту фразы; поле оставлено для ручных записей */
  audio?: { voice: string; file: string }[]
  unitId: string
  /** Слова, которые разрешено использовать до их официального ввода (правило i+1) */
  newWordIds?: WordId[]
  reviewed: boolean
}

export type Dialogue = {
  id: string
  unitId: string
  title: string
  characters: string[]
  /** choices — ловушки для реплик «me»: выбери верный ответ, потом скажи его вслух */
  lines: { speaker: string; sentenceId: SentenceId; choices?: SentenceId[] }[]
  cultureNote?: string
}

/** Персонаж «Командировки». voice — голос синтеза; «me» (стажёр, это ты) — голос из настроек. */
export type Character = { id: string; hanzi: string; pinyin: string; ru: string; voice: string }

/** Эпизод сюжета: открывается после этапа unlockAfter. */
export type Episode = {
  id: string
  n: number
  title: string
  blurb: string
  unlockAfter: string
  lessonId: LessonId
  dialogueId: string
}

/** Пример в объяснении: слог + иероглиф + перевод (妈 mā — мама). */
export type Example = { syl: Syllable; hanzi?: string; ru?: string }

/** Контраст для «Какой слог?»: чем различаются варианты. */
export type Contrast = { label: string; skill: 'initial' | 'final' | 'tone' }

export type LessonPart =
  | {
      type: 'explain'
      title: string
      body: string[]
      /** графики тонов по шкале Чао */
      chart?: Tone[]
      /** кнопки прослушивания */
      examples?: Example[]
      words?: WordId[]
      /** показать «словарный → как звучит» для этих слов */
      sandhi?: WordId[]
      /** примеры-фразы (грамматика) */
      sentences?: SentenceId[]
      mascot?: 'happy' | 'thinking' | 'wink' | 'oops' | 'celebrate'
    }
  | { type: 'listen'; title?: string; series: Item[][] }
  | { type: 'repeat'; items: Item[] }
  | { type: 'guessTone'; items: Syllable[]; choices: Tone[] }
  | { type: 'whichSyllable'; contrast: Contrast; items: { answer: Syllable; options: Syllable[] }[] }
  | { type: 'guessPair'; items: WordId[] }
  | { type: 'read'; items: Item[] }
  /** Угадай значение: по звуку или по иероглифам с пиньинем — выбрать перевод из 4 */
  | { type: 'meaning'; prompt: 'audio' | 'text'; items: WordId[] }
  /** Фразы: разбор по словам, перевод, дословно, звук */
  | { type: 'sentences'; items: SentenceId[] }
  /** Сборка: собрать фразу из перемешанных слов, потом послушать и повторить */
  | { type: 'assemble'; items: SentenceId[] }
  /** Скажи сам: по-русски → сказать по-китайски → сверить с образцом */
  | { type: 'sayIt'; items: (WordId | SentenceId)[] }
  /** Диалог: реплики персонажей их голосами, на своих — выбрать ответ и сказать вслух */
  | { type: 'dialogue'; id: string }

export type Lesson = {
  id: LessonId
  unitId: string
  order: number
  title: string
  /** слова, которые урок вводит (попадают в словарь после урока) */
  newWords: WordId[]
  parts: LessonPart[]
  /** «босс» — итоговый тест с порогом успеха */
  boss?: { passPercent: number }
}

export type Unit = {
  id: string
  stage: 0 | 1 | 2 | 3
  order: number
  /** «0.1» — номер для людей */
  code: string
  title: string
  /** ситуация для ролевого диалога с Claude */
  situation?: string
  goals: string[]
  lessons: LessonId[]
  newWords: WordId[]
  sentences: SentenceId[]
  dialogues: string[]
  grammarNotes: { title: string; ru: string; examples: SentenceId[] }[]
  boss: string
}

export type Content = {
  units: Unit[]
  lessons: Lesson[]
  words: Word[]
  sentences: Sentence[]
  dialogues: Dialogue[]
  characters?: Character[]
  episodes?: Episode[]
}
