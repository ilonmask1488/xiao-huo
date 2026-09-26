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
import { loadContent } from './content_files.ts'

const root = join(import.meta.dirname, '..')
const load = <T>(file: string): T => JSON.parse(readFileSync(join(root, file), 'utf8')) as T

const content: Content = loadContent(root)
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
const neutral: string[] = []
for (const w of content.words) {
  // Словарный пиньинь: сандхи 不/一 у нас считается отдельно (src/lib/pinyin/sandhi.ts).
  const ref = pinyin(w.hanzi, { toneType: 'num', type: 'array', v: true, toneSandhi: false }).map((s) => s.replace(/0$/, '5'))
  const ours = w.pinyin.trim().split(/\s+/).map((s) => (/[1-5]$/.test(s) ? s : `${s}5`))
  if (ref.join(' ') === ours.join(' ')) continue
  // Нейтральный второй слог (谢谢 xièxie, 朋友 péngyou) — норма разговорного путунхуа, а не ошибка.
  const onlyNeutral = ours.every((s, i) => s === ref[i] || (s.endsWith('5') && s.slice(0, -1) === ref[i]?.slice(0, -1)))
  const line = `${w.hanzi} (${w.id}): у нас ${ours.join(' ')}, pinyin-pro: ${ref.join(' ')}`
  if (onlyNeutral) neutral.push(line)
  else mismatches.push(line)
}

// Фразы целиком: pinyin-pro учитывает контекст, поэтому лучше различает многозвучные иероглифы.
const sentenceMismatches: string[] = []
for (const s of content.sentences) {
  const text = s.tokens.map((t) => t.hanzi).join('')
  const ref = pinyin(text, { toneType: 'num', type: 'array', v: true, toneSandhi: false, nonZh: 'removed' })
    .map((x) => x.replace(/0$/, '5'))
    .filter((x) => /[a-z]/.test(x))
  const ours = s.tokens.flatMap((t) => t.pinyin.split(/\s+/).filter(Boolean))
  const diffs = ours
    .map((o, i) => [o, ref[i] ?? '?'] as const)
    .filter(([o, r]) => o !== r && !(o.endsWith('5') && o.slice(0, -1) === r.slice(0, -1)))
  if (ref.length !== ours.length || diffs.length)
    sentenceMismatches.push(`${s.id} ${text}: ${diffs.map(([o, r]) => `${o}≠${r}`).join(', ') || `слогов ${ours.length}≠${ref.length}`}`)
}

console.log(
  `Контент: ${content.units.length} этапов, ${content.lessons.length} уроков, ${content.words.length} слов, ` +
    `${content.sentences.length} фраз, ${content.dialogues.length} диалогов; звук: ${Object.keys(manifest.syllables).length} слогов, ${Object.keys(manifest.texts).length} слов`,
)
for (const m of mismatches) console.log(`  пиньинь расходится с pinyin-pro (проверь вручную): ${m}`)
for (const m of neutral) console.log(`  нейтральный тон там, где у pinyin-pro полный (норма речи, проверено): ${m}`)
for (const m of sentenceMismatches) console.log(`  фраза: пиньинь расходится с pinyin-pro (проверь вручную): ${m}`)
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
