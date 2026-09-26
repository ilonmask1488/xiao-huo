/* Общие функции данных порядка черт (для npm run hanzi и check:content). */
import type { Content } from '../src/content/types.ts'

/** Имя файла по коду символа: 你 → 4f60.json (без не-ASCII в адресах). */
export const hanziFile = (ch: string) => `${ch.codePointAt(0)!.toString(16)}.json`

/** Иероглифы всех слов курса. */
export function courseChars(content: Content): string[] {
  const chars = new Set<string>()
  for (const w of content.words) for (const ch of w.hanzi) if (/[㐀-鿿]/.test(ch)) chars.add(ch)
  return [...chars].sort()
}