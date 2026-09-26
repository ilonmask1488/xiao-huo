/*
  npm run check:content — контроль качества контента (ТЗ §9.4, PHASE1 §5).
  Падает (код 1) при битых ссылках, отсутствии звука, неверных минимальных и тоновых парах.
  Пиньинь каждого слова сверяется с pinyin-pro: расхождения выводятся списком, а не исправляются
  (многозвучные иероглифы проверяет человек).
*/
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pinyin } from 'pinyin-pro'
import type { Content } from '../src/content/types.ts'
import { checkContent } from './content_checks.ts'

const root = join(import.meta.dirname, '..')
const load = <T>(file: string): T => JSON.parse(readFileSync(join(root, file), 'utf8')) as T

const content: Content = {
  units: load('src/content/units.json'),
  lessons: load('src/content/lessons.json'),
  words: load('src/content/words.json'),
  sentences: load('src/content/sentences.json'),
  dialogues: load('src/content/dialogues.json'),
}
const manifest = load<{ syllables: Record<string, { file: string }>; texts: Record<string, { file: string }[]> }>(
  'public/audio/manifest.json',
)

const hasFile = (file: string) => existsSync(join(root, 'public/audio', file))
const report = checkContent(content, hasFile, {
  syllables: new Set(Object.keys(manifest.syllables)),
  texts: new Set(Object.keys(manifest.texts)),
})

// Все файлы из манифеста существуют.
for (const [k, e] of Object.entries(manifest.syllables)) if (!hasFile(e.file)) report.errors.push(`звук слога ${k}: нет файла ${e.file}`)
for (const [k, es] of Object.entries(manifest.texts))
  for (const e of es) if (!hasFile(e.file)) report.errors.push(`звук «${k}»: нет файла ${e.file}`)

// Сверка пиньиня с pinyin-pro (тоны цифрами, ü = v).
const mismatches: string[] = []
for (const w of content.words) {
  const ref = pinyin(w.hanzi, { toneType: 'num', type: 'array', v: true }).map((s) => s.replace(/0$/, '5'))
  const ours = w.pinyin.trim().split(/\s+/).map((s) => (/[1-5]$/.test(s) ? s : `${s}5`))
  if (ref.join(' ') !== ours.join(' ')) mismatches.push(`${w.hanzi} (${w.id}): у нас ${ours.join(' ')}, pinyin-pro: ${ref.join(' ')}`)
}

console.log(
  `Контент: ${content.units.length} этапов, ${content.lessons.length} уроков, ${content.words.length} слов, ` +
    `${content.sentences.length} фраз, ${content.dialogues.length} диалогов; звук: ${Object.keys(manifest.syllables).length} слогов, ${Object.keys(manifest.texts).length} слов`,
)
for (const m of mismatches) console.log(`  пиньинь расходится с pinyin-pro (проверь вручную): ${m}`)
for (const w of report.warnings) console.log(`  предупреждение: ${w}`)
for (const e of report.errors) console.error(`  ОШИБКА: ${e}`)
console.log(
  `Не проверено вручную (reviewed: false): ${report.unreviewed} из ${report.total}` +
    (report.total ? ` (${Math.round((100 * report.unreviewed) / report.total)}%)` : ''),
)

if (report.errors.length) {
  console.error(`\nПроверка не пройдена: ${report.errors.length} ошибок.`)
  process.exit(1)
}
console.log('\nПроверка пройдена.')
