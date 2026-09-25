import Dexie, { type EntityTable } from 'dexie'
import { DB_NAME, SCHEMA_VERSIONS } from './schema'
import type {
  AchievementRow,
  CardRow,
  DayRow,
  GameRecordRow,
  MetaKey,
  MetaRow,
  ReviewRow,
  SettingsRow,
  ToneStatRow,
  UnitProgressRow,
} from './types'

export class AppDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'id'>
  meta!: EntityTable<MetaRow, 'key'>
  cards!: EntityTable<CardRow, 'id'>
  reviews!: EntityTable<ReviewRow, 'id'>
  toneStats!: EntityTable<ToneStatRow, 'pair'>
  days!: EntityTable<DayRow, 'date'>
  achievements!: EntityTable<AchievementRow, 'id'>
  gameRecords!: EntityTable<GameRecordRow, 'game'>
  unitProgress!: EntityTable<UnitProgressRow, 'unitId'>

  constructor(name = DB_NAME) {
    super(name)
    for (const v of SCHEMA_VERSIONS) {
      const version = this.version(v.version).stores(v.stores)
      if (v.upgrade) version.upgrade(v.upgrade)
    }
  }

  async getMeta<T extends MetaRow['value']>(key: MetaKey): Promise<T | undefined> {
    return (await this.meta.get(key))?.value as T | undefined
  }

  async setMeta(key: MetaKey, value: MetaRow['value']): Promise<void> {
    await this.meta.put({ key, value })
  }
}

export const db = new AppDB()

/** Таблицы прогресса — то, что стирает «Сбросить прогресс». Настройки остаются. */
export const PROGRESS_TABLES = [
  'cards',
  'reviews',
  'toneStats',
  'days',
  'achievements',
  'gameRecords',
  'unitProgress',
] as const

export async function resetProgress(database: AppDB = db): Promise<void> {
  await database.transaction('rw', [...PROGRESS_TABLES], async () => {
    await Promise.all(PROGRESS_TABLES.map((t) => database.table(t).clear()))
  })
}
