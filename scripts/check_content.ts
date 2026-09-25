/*
  npm run check:content — контроль качества контента (ТЗ §9.4).
  Падает (код 1) при битых ссылках между сущностями и отсутствии аудио.
  Сверка пиньиня с pinyin-pro подключается в фазе 1 вместе с первым контентом.
*/
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkContent } from './content_checks.ts'
import type { Content } from '../src/content/types.ts'

const root = join(import.meta.dirname, '..')
const load = <T>(name: string): T => JSON.parse(readFileSync(join(root, 'src/content', `${name}.json`), 'utf8')) as T

const content: Content = {
  units: load('units'),
  words: load('words'),
  sentences: load('sentences'),
  dialogues: load('dialogues'),
}

const report = checkContent(content, (file) => existsSync(join(root, 'public/audio', file)))

console.log(
  `Контент: ${content.units.length} этапов, ${content.words.length} слов, ` +
    `${content.sentences.length} фраз, ${content.dialogues.length} диалогов`,
)
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
