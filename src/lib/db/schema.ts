/*
  История схемы базы. Старые версии НЕ редактируются — только добавляются новые.
  Каждая новая версия, меняющая формат записей, даёт:
    - upgrade   — миграцию живой базы (Dexie вызывает её при открытии);
    - migrateBackup — то же преобразование для таблиц из старого бэкапа.
  Тест src/lib/db/migrations.test.ts открывает базу каждой исторической версии
  с данными и проверяет, что после обновления до текущей ничего не пропало.
*/
import type { Transaction } from 'dexie'

export type BackupTables = Record<string, unknown[]>

export type SchemaVersion = {
  version: number
  stores: Record<string, string | null>
  upgrade?: (tx: Transaction) => Promise<void> | void
  migrateBackup?: (tables: BackupTables) => BackupTables
}

export const DB_NAME = 'xiaohuo'

export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: 1,
    stores: {
      settings: 'id',
      meta: 'key',
      cards: 'id, itemId, kind, due, state',
      reviews: '++id, cardId, at',
      toneStats: 'pair',
      days: 'date',
      achievements: 'id',
      gameRecords: 'game',
      unitProgress: 'unitId',
    },
  },
  {
    // Фаза 1: ответы в уроках и играх, прогресс уроков, ежедневный «пуск».
    // Новые таблицы пустые — существующие данные не меняются, миграция бэкапа не нужна.
    version: 2,
    stores: {
      answers: '++id, at, kind, item, lessonId',
      lessonProgress: 'lessonId',
      launches: 'date',
    },
  },
]

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1]!.version

/** Все таблицы текущей схемы (удалённые — со значением null — не входят). */
export const TABLE_NAMES: string[] = (() => {
  const tables = new Map<string, boolean>()
  for (const v of SCHEMA_VERSIONS) {
    for (const [name, def] of Object.entries(v.stores)) tables.set(name, def !== null)
  }
  return [...tables].filter(([, alive]) => alive).map(([name]) => name)
})()
