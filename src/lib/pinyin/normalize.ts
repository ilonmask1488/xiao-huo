/*
  Нормализация пиньиня: знаки тонов → цифры, ü / u: / v → v.
  Используется для поиска и сравнения ввода пользователя.
*/
import type { Tone } from './marks'

const MARKED: Record<string, [string, Tone]> = {}
const TABLE: [string, string][] = [
  ['a', 'āáǎà'],
  ['e', 'ēéěè'],
  ['i', 'īíǐì'],
  ['o', 'ōóǒò'],
  ['u', 'ūúǔù'],
  ['v', 'ǖǘǚǜ'],
]
for (const [base, marks] of TABLE) {
  ;[...marks].forEach((m, i) => {
    MARKED[m] = [base, (i + 1) as Tone]
    MARKED[m.toUpperCase()] = [base, (i + 1) as Tone]
  })
}

function unifyU(s: string): string {
  return s.toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v')
}

/**
  Один слог со знаком или цифрой → «ma3». Без тона → без цифры («ma»).
  «lǜ» → «lv4», «lü4» → «lv4», «lu:4» → «lv4».
*/
export function syllableToNumeric(input: string): string {
  let tone: Tone | undefined
  let out = ''
  for (const ch of unifyU(input.trim())) {
    const m = MARKED[ch]
    if (m) {
      out += m[0]
      tone = m[1]
    } else out += ch
  }
  if (/[1-5]$/.test(out)) return out
  return tone ? `${out}${tone}` : out
}

/** «nǐ hǎo» → «ni3 hao3»; «Nǐ, hǎo!» → «ni3 hao3». */
export function toNumeric(input: string): string {
  return input
    .split(/[\s,.!?，。！？'’-]+/)
    .filter(Boolean)
    .map(syllableToNumeric)
    .join(' ')
}

/** Тоны из пиньиня с цифрами: «ni3 hao3» → [3, 3]; нейтральный без цифры → 5. */
export function tonesOf(numeric: string): Tone[] {
  return numeric
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => Number(/([1-5])$/.exec(s)?.[1] ?? 5) as Tone)
}

/** «ma3» → «ma», «lv4» → «lv». */
export function baseOf(numericSyllable: string): string {
  return numericSyllable.replace(/[1-5]$/, '')
}

/*
  Поиск по пиньиню. Запрос может быть с тонами или без, цифрами или знаками,
  слитно или раздельно: «nihao», «ni3hao3», «nǐhǎo», «ni hao», «ni3hao».
  Указанный тон обязан совпасть с тоном слога слова, куда попадает его буква;
  где тон не указан — подходит любой.
*/
export function pinyinQueryMatcher(query: string): ((numericPinyin: string) => boolean) | null {
  // Разбираем запрос в буквы + привязки тонов к позициям букв.
  const letters: string[] = []
  const tones: { at: number; tone: Tone }[] = []
  for (const ch of unifyU(query)) {
    const m = MARKED[ch]
    if (m) {
      tones.push({ at: letters.length, tone: m[1] })
      letters.push(m[0])
    } else if (/[1-5]/.test(ch)) {
      if (letters.length) tones.push({ at: letters.length - 1, tone: Number(ch) as Tone })
    } else if (/[a-z]/.test(ch)) letters.push(ch)
  }
  if (!letters.length) return null
  const needle = letters.join('')

  return (numericPinyin) => {
    // Слово: буквы без тонов + номер слога для каждой буквы.
    const sylTones: Tone[] = []
    const owner: number[] = []
    let hay = ''
    for (const syl of numericPinyin.trim().split(/\s+/)) {
      const n = syllableToNumeric(syl)
      const base = baseOf(n)
      const idx = sylTones.length
      sylTones.push(Number(/([1-5])$/.exec(n)?.[1] ?? 5) as Tone)
      for (const ch of base) {
        hay += ch
        owner.push(idx)
      }
    }
    for (let from = hay.indexOf(needle); from >= 0; from = hay.indexOf(needle, from + 1)) {
      if (tones.every((t) => sylTones[owner[from + t.at]!] === t.tone)) return true
    }
    return false
  }
}
