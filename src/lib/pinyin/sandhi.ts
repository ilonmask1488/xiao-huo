/*
  Изменение тонов (сандхи) внутри слова и устойчивых сочетаний — без просодии целой фразы.
  1. 3 + 3 → 2 + 3. В цепочке третьих тонов все, кроме последнего, становятся вторыми.
  2. 不 bù перед 4-м тоном → bú (不是 bú shì).
  3. 一 yī: перед 4-м → yí (一个 yí ge), перед 1–3-м → yì (一天 yì tiān);
     отдельно, в конце, в порядковых (第一) и внутри чисел (十一) — yī.
*/
import { markSyllables } from './marks'

export type SandhiRule = 'third' | 'bu' | 'yi'

export type SandhiResult = {
  /** произносимый пиньинь с цифрами */
  spoken: string
  /** какие правила сработали и на каких слогах (индексы) */
  applied: { rule: SandhiRule; index: number }[]
}

/** 一 после них — часть числа (十一, 二十一) или порядковое (第一): остаётся yī. */
const YI_KEEPS_AFTER = new Set([...'第零一二三四五六七八九十两'])
/** 一 перед ними — чтение цифр подряд (一二三): yī. Перед 百/千/万 сандхи работает: yìbǎi. */
const YI_KEEPS_BEFORE = new Set([...'零一二三四五六七八九十'])

export function applySandhi(numeric: string, hanzi?: string): SandhiResult {
  const syl = numeric.trim().split(/\s+/)
  const chars = hanzi ? [...hanzi.replace(/\s+/g, '')] : []
  const hasChars = chars.length === syl.length
  const tone = (s: string) => Number(/([1-5])$/.exec(s)?.[1] ?? 5)
  const base = (s: string) => s.replace(/[1-5]$/, '')
  const out = [...syl]
  const applied: SandhiResult['applied'] = []

  // 不 и 一 смотрят на словарный тон следующего слога.
  for (let i = 0; i < syl.length; i++) {
    const next = syl[i + 1]
    const ch = hasChars ? chars[i] : undefined
    if (base(syl[i]!) === 'bu' && tone(syl[i]!) === 4 && next && (!hasChars || ch === '不')) {
      if (tone(next) === 4) {
        out[i] = 'bu2'
        applied.push({ rule: 'bu', index: i })
      }
    }
    if (base(syl[i]!) === 'yi' && tone(syl[i]!) === 1 && (!hasChars || ch === '一')) {
      const prev = hasChars ? chars[i - 1] : undefined
      const nextCh = hasChars ? chars[i + 1] : undefined
      const inNumber = (prev && YI_KEEPS_AFTER.has(prev)) || (nextCh && YI_KEEPS_BEFORE.has(nextCh))
      if (next && !inNumber) {
        const t = tone(next)
        if (t === 4 || t === 5) {
          // 一个 yí ge: у 个 словарный тон 4-й (gè), в речи он часто нейтральный
          out[i] = 'yi2'
          applied.push({ rule: 'yi', index: i })
        } else if (t >= 1 && t <= 3) {
          out[i] = 'yi4'
          applied.push({ rule: 'yi', index: i })
        }
      }
    }
  }

  // 3 + 3: все третьи в цепочке, кроме последнего, → 2.
  for (let i = 0; i < out.length; i++) {
    if (tone(out[i]!) !== 3) continue
    let j = i
    while (j + 1 < out.length && tone(out[j + 1]!) === 3) j++
    for (let k = i; k < j; k++) {
      out[k] = `${base(out[k]!)}2`
      applied.push({ rule: 'third', index: k })
    }
    i = j
  }

  applied.sort((a, b) => a.index - b.index)
  return { spoken: out.join(' '), applied }
}

/** Отличается ли произношение от словарного. */
export function hasSandhi(numeric: string, hanzi?: string): boolean {
  return applySandhi(numeric, hanzi).applied.length > 0
}

/** «ni3 hao3» → «ní hǎo» (произносимый, со знаками). */
export function spokenMarked(numeric: string, hanzi?: string): string {
  return markSyllables(applySandhi(numeric, hanzi).spoken)
    .map((s) => s.text)
    .join(' ')
}
