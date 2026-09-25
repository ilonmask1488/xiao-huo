/*
  Пиньинь с цифрами → пиньинь со знаками тонов.
  Хранение: «ni3 hao3», нейтральный тон — 5 (или без цифры), ü — v (также u: и ü).
  Знак ставится на a или e, если есть; в «ou» — на o; иначе на последнюю гласную (liù, guǐ).
*/

export type Tone = 1 | 2 | 3 | 4 | 5
export type MarkedSyllable = { text: string; tone: Tone; numeric: string }

const MARKS: Record<string, readonly [string, string, string, string]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
  A: ['Ā', 'Á', 'Ǎ', 'À'],
  E: ['Ē', 'É', 'Ě', 'È'],
  I: ['Ī', 'Í', 'Ǐ', 'Ì'],
  O: ['Ō', 'Ó', 'Ǒ', 'Ò'],
  U: ['Ū', 'Ú', 'Ǔ', 'Ù'],
  Ü: ['Ǖ', 'Ǘ', 'Ǚ', 'Ǜ'],
}

const SYLLABLE = /^([a-zA-ZüÜ:]+?)([1-5])?$/

/** «lv4» → { text: 'lǜ', tone: 4 }. Бросает ошибку на том, что не похоже на слог. */
export function markSyllable(numeric: string): MarkedSyllable {
  const m = SYLLABLE.exec(numeric)
  if (!m) throw new Error(`Не слог пиньиня: «${numeric}»`)
  const base = m[1]!.replace(/u:|v/g, 'ü').replace(/U:|V/g, 'Ü')
  const tone = Number(m[2] ?? 5) as Tone
  if (tone === 5) return { text: base, tone, numeric }

  const lower = base.toLowerCase()
  let at = lower.indexOf('a')
  if (at < 0) at = lower.indexOf('e')
  if (at < 0 && lower.includes('ou')) at = lower.indexOf('ou')
  if (at < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i]!)) {
        at = i
        break
      }
    }
  }
  if (at < 0) return { text: base, tone, numeric } // слог без гласной (hm, ng) — без знака

  const ch = base[at]!
  const marked = MARKS[ch]![tone - 1]!
  return { text: base.slice(0, at) + marked + base.slice(at + 1), tone, numeric }
}

/** «ni3 hao3» → [{nǐ,3},{hǎo,3}] */
export function markSyllables(numeric: string): MarkedSyllable[] {
  return numeric.trim().split(/\s+/).filter(Boolean).map(markSyllable)
}

/** «ni3 hao3» → «nǐ hǎo» */
export function toMarked(numeric: string): string {
  return markSyllables(numeric)
    .map((s) => s.text)
    .join(' ')
}
