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
