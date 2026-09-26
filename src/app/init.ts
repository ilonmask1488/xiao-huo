import { db } from '../lib/db/db'
import { ensureCardsForCompleted } from '../lib/srs/cards'

/**
  Первый запуск: запоминаем дату (от неё считается напоминание о бэкапе)
  и просим браузер не удалять данные при нехватке места.
  Каждый запуск: у слов пройденных уроков должны быть карточки повторения
  (после обновления приложения или восстановления бэкапа).
*/
export async function initApp(): Promise<void> {
  try {
    if ((await db.getMeta('firstLaunchAt')) === undefined) await db.setMeta('firstLaunchAt', Date.now())
    if (navigator.storage?.persist) {
      const persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist())
      await db.setMeta('storagePersisted', persisted)
    }
  } catch (e) {
    console.error('initApp', e)
  }
  try {
    await ensureCardsForCompleted()
  } catch (e) {
    console.error('ensureCardsForCompleted', e)
  }
}
