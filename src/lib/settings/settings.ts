import { useLiveQuery } from 'dexie-react-hooks'
import { db, type AppDB } from '../db/db'
import type { Settings } from '../db/types'

export const DEFAULT_SETTINGS: Settings = {
  sessionMinutes: 40,
  audioRate: 1,
  voice: 'female',
  hanziMode: 'always',
  toneColors: true,
  sfx: true,
  vibration: true,
  theme: 'system',
  desiredRetention: 0.9,
  hskScale: 'hsk3',
  hanziOnlyCardsEarly: false,
}

export async function loadSettings(database: AppDB = db): Promise<Settings> {
  const { id: _id, ...stored } = (await database.settings.get('main')) ?? { id: 'main' }
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function updateSettings(patch: Partial<Settings>, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.settings, async () => {
    const current = (await database.settings.get('main')) ?? { id: 'main' as const }
    await database.settings.put({ ...current, ...patch, id: 'main' })
  })
}

/** Живые настройки: до первого чтения из базы — значения по умолчанию. */
export function useSettings(): Settings {
  return useLiveQuery(() => loadSettings(), [], DEFAULT_SETTINGS)
}

/*
  Тема и цвета тонов дублируются в localStorage, чтобы inline-скрипт в index.html
  применил их до отрисовки и не было вспышки светлой темы. Хранилище может быть
  недоступно (приватный режим) — тогда просто работаем без зеркала.
*/
const MIRROR_KEY = 'xiaohuo:appearance'

export function applyAppearance(s: Pick<Settings, 'theme' | 'toneColors'>): void {
  const root = document.documentElement
  if (s.theme === 'system') delete root.dataset.theme
  else root.dataset.theme = s.theme
  if (s.toneColors) delete root.dataset.toneColors
  else root.dataset.toneColors = 'off'

  // Два meta theme-color с media: при «системной» теме браузер выбирает сам,
  // при ручной — оба получают цвет выбранной темы.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  metas.forEach((m) => {
    const own = m.media.includes('dark') ? '#121417' : '#f5f2ea'
    m.content = s.theme === 'system' ? own : s.theme === 'dark' ? '#121417' : '#f5f2ea'
  })

  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify({ theme: s.theme, toneColors: s.toneColors }))
  } catch {
    /* нет доступа к localStorage — не критично */
  }
}
