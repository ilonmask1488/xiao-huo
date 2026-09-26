/*
  Перевод слова в едином формате (UX §7): значения через «; », пояснение в скобках — после значений.
  В данных ru: string[] — значения и заметки вида «(частица вопроса)».
*/
import type { Word } from '../content/types'

export function isNote(item: string): boolean {
  return item.startsWith('(')
}

/** «а ты?; а как насчёт… (частица встречного вопроса)» */
export function wordRu(w: Pick<Word, 'ru'>): string {
  const values = w.ru.filter((r) => !isNote(r)).join('; ')
  const notes = w.ru.filter(isNote).join(' ')
  return [values, notes].filter(Boolean).join(' ')
}

/** Первое значение — для вариантов ответа и коротких подписей. */
export function meaningOf(w: Pick<Word, 'ru'>): string {
  return w.ru.find((r) => !isNote(r)) ?? w.ru[0] ?? ''
}
