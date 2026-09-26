/* Модель учебного контента (ТЗ §9.1 + уроки ступени 0). Пиньинь хранится с цифрами: «gong1 cheng2 shi1», ü — v. */
/** 1–4 и 5 — нейтральный (тот же тип, что в lib/pinyin). */
export type Tone = 1 | 2 | 3 | 4 | 5

export type WordId = string // всегда начинается с «w-»
export type SentenceId = string
export type LessonId = string

/** Слог с тоном: «ma3», «lv4». Нейтральный — 5. */
export type Syllable = string

/** Что озвучить: слог («ma3») или слово (id «w-nihao»). */
export type Item = Syllable | WordId

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
  id: SentenceId
  tokens: Token[] // явная разбивка на слова — не сегментировать на лету
  ru: string
  literal?: string
  audio: { voice: string; file: string }[]
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
  lines: { speaker: string; sentenceId: SentenceId }[]
  cultureNote?: string
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
      mascot?: 'happy' | 'thinking' | 'wink' | 'oops' | 'celebrate'
    }
  | { type: 'listen'; title?: string; series: Item[][] }
  | { type: 'repeat'; items: Item[] }
  | { type: 'guessTone'; items: Syllable[]; choices: Tone[] }
  | { type: 'whichSyllable'; contrast: Contrast; items: { answer: Syllable; options: Syllable[] }[] }
  | { type: 'guessPair'; items: WordId[] }
  | { type: 'read'; items: Item[] }

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
}
