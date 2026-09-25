/* Модель учебного контента (ТЗ §9.1). Пиньинь хранится с цифрами: «gong1 cheng2 shi1», ü — v. */

export type WordId = string
export type SentenceId = string

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

export type Unit = {
  id: string
  stage: 0 | 1 | 2 | 3
  order: number
  title: string
  goals: string[]
  newWords: WordId[]
  sentences: SentenceId[]
  dialogues: string[]
  grammarNotes: { title: string; ru: string; examples: SentenceId[] }[]
  boss: string
}

export type Content = { units: Unit[]; words: Word[]; sentences: Sentence[]; dialogues: Dialogue[] }
