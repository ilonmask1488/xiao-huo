/*
  Записи прогресса в IndexedDB. Правило: в базе только JSON-совместимые значения
  (время — числом миллисекунд, не Date), чтобы бэкап сохранялся и восстанавливался без потерь.
*/

export type ThemeSetting = 'system' | 'light' | 'dark'
export type HanziMode = 'always' | 'after' | 'never'
export type VoiceSetting = 'female' | 'male'
export type HskScale = 'hsk2' | 'hsk3'

export type Settings = {
  sessionMinutes: 20 | 30 | 40 | 45
  audioRate: 0.75 | 1
  voice: VoiceSetting
  hanziMode: HanziMode
  toneColors: boolean
  sfx: boolean
  vibration: boolean
  theme: ThemeSetting
  desiredRetention: 0.85 | 0.9 | 0.95
  hskScale: HskScale
  /** Карточки «иероглифы без пиньиня» до второй ступени */
  hanziOnlyCardsEarly: boolean
}

export type SettingsRow = Partial<Settings> & { id: 'main' }

export type MetaKey =
  | 'firstLaunchAt'
  | 'lastBackupAt'
  | 'backupReminderDismissedAt'
  | 'installHintDismissedAt'
  | 'storagePersisted'
  | 'soundChecked'

export type MetaRow = { key: MetaKey; value: number | boolean | string }

/** Карточка FSRS (фаза 2). Даты — миллисекунды. */
export type CardRow = {
  id: string // `${itemId}:${kind}`
  itemId: string
  kind: 1 | 2 | 3 | 4 | 5
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3
  lastReview?: number
}

export type ReviewRow = {
  id?: number
  cardId: string
  at: number
  rating: 1 | 2 | 3 | 4
  durationMs: number
}

/** Статистика тоновой пары: ключ «13» — первый слог 1-й тон, второй 3-й. */
export type ToneStatRow = {
  pair: string
  correct: number
  wrong: number
  /** Что пользователь выбрал вместо верного ответа: «14» → сколько раз */
  confusions: Record<string, number>
}

export type DayRow = {
  date: string // YYYY-MM-DD по местному времени
  seconds: number
  dv: number
  spokenCount: number
  newWords: number
}

export type AchievementRow = { id: string; unlockedAt: number }

export type GameRecordRow = { game: string; best: number; weekBest: number; weekStart: string }

export type UnitProgressRow = { unitId: string; lessonsDone: number; completedAt?: number }

/* ——— Схема v2 (фаза 1) ——— */

export type AnswerKind = 'tone' | 'syllable' | 'pair' | 'self'
export type AnswerSource = 'lesson' | 'game' | 'launch'

/** Один ответ в уроке или игре — источник статистики и тепловой карты. */
export type AnswerRow = {
  id?: number
  at: number
  kind: AnswerKind
  source: AnswerSource
  /** что звучало: «ma3», «w-nihao» */
  item: string
  expected: string
  given: string
  correct: boolean
  lessonId?: string
  game?: string
  /** для «Какой слог?»: навык и контраст («initial», «zh/z») */
  skill?: 'tone' | 'initial' | 'final' | 'pair'
  contrast?: string
}

/** Прогресс урока: где остановился и чем закончил. */
export type LessonProgressRow = {
  lessonId: string
  /** индекс текущего экрана при незаконченном прохождении */
  step: number
  /** ответы текущего прохождения: индекс экрана → верно ли */
  results: Record<string, boolean>
  startedAt: number
  updatedAt: number
  seconds: number
  completedAt?: number
  timesCompleted: number
  bestAccuracy?: number
}

export type LaunchBlockState = {
  id: 'warmup' | 'review' | 'new' | 'echo' | 'speak'
  status: 'pending' | 'done' | 'skipped'
  lessonId?: string
  /** пропущен автоматически (не было материала), а не пользователем — пересчитывается */
  auto?: boolean
}

/** Ежедневный «пуск»: какие блоки собраны и сколько пройдено. */
export type LaunchRow = {
  date: string
  blocks: LaunchBlockState[]
  startedAt: number
  finishedAt?: number
  seconds: number
  dv: number
  correct: number
  total: number
}
