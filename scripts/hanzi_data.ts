/*
  npm run hanzi — данные порядка черт для иероглифов курса → public/hanzi/<код>.json.
  Источник — hanzi-writer-data (данные Make Me a Hanzi, Arphic Public License; текст лицензии копируется рядом).
  Берём только иероглифы слов курса: ~2–3 КБ на знак, грузятся по требованию и кэшируются для офлайна.
*/
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { loadContent } from './content_files.ts'
import { courseChars, hanziFile } from './hanzi_lib.ts'

const root = join(import.meta.dirname, '..')
const src = join(root, 'node_modules', 'hanzi-writer-data')
const out = join(root, 'public', 'hanzi')

if (!existsSync(src)) throw new Error('Нет node_modules/hanzi-writer-data — выполни npm install')
mkdirSync(out, { recursive: true })
const chars = courseChars(loadContent(root))
const keep = new Set(chars.map(hanziFile))
for (const f of readdirSync(out)) if (f.endsWith('.json') && !keep.has(f)) rmSync(join(out, f))
const missing: string[] = []
for (const ch of chars) {
  const from = join(src, `${ch}.json`)
  if (existsSync(from)) copyFileSync(from, join(out, hanziFile(ch)))
  else missing.push(ch)
}
copyFileSync(join(src, 'ARPHICPL.TXT'), join(out, 'ARPHICPL.TXT'))
console.log(`Порядок черт: ${chars.length - missing.length} из ${chars.length} иероглифов → public/hanzi`)
if (missing.length) console.log(`  нет данных: ${missing.join(' ')}`)