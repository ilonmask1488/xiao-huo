/* Где лежит контент: ступени — отдельными папками. Используется check_content и тестами. */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Content } from '../src/content/types.ts'

export const CONTENT_DIRS = ['src/content', 'src/content/stage1', 'src/content/story']

export function loadContent(root: string): Content {
  const all = <T>(name: string): T[] =>
    CONTENT_DIRS.flatMap((d) => {
      const p = join(root, d, `${name}.json`)
      return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T[]) : []
    })
  return {
    units: all('units'),
    lessons: all('lessons'),
    words: all('words'),
    sentences: all('sentences'),
    dialogues: all('dialogues'),
    characters: all('characters'),
    episodes: all('episodes'),
  }
}
