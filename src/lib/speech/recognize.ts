/*
  Распознавание речи (бета, ТЗ §7.4): Web Speech API с zh-CN, только если браузер его умеет.
  Сравниваем иероглифы — тоны распознавание напрямую не проверяет.
*/

type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function recognitionSupported(): boolean {
  return !!ctor()
}

export type Listening = { result: Promise<string[]>; stop: () => void; cancel: () => void }

/** Одна попытка: варианты распознанного текста (лучший первым); пусто — ничего не услышано. */
export function listen(lang = 'zh-CN'): Listening {
  const Ctor = ctor()
  if (!Ctor) throw new Error('unsupported')
  const r = new Ctor()
  r.lang = lang
  r.interimResults = false
  r.maxAlternatives = 3
  r.continuous = false
  let alts: string[] = []
  const result = new Promise<string[]>((resolve, reject) => {
    r.onresult = (e) => {
      const first = e.results[0]
      alts = first ? Array.from({ length: first.length }, (_, i) => first[i]!.transcript) : []
    }
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') resolve([])
      else reject(new Error(e.error))
    }
    r.onend = () => resolve(alts)
  })
  r.start()
  return { result, stop: () => r.stop(), cancel: () => r.abort() }
}

const DIGITS = '零一二三四五六七八九'

/** Распознавание часто пишет числа цифрами: 3点 → 三点, 25 → 二十五. */
export function numbersToHanzi(text: string): string {
  return text.replace(/\d+/g, (m) => {
    const n = Number(m)
    if (!Number.isFinite(n) || n >= 10000 || m.length > 1 && m.startsWith('0')) return [...m].map((d) => DIGITS[Number(d)]).join('')
    if (n < 10) return DIGITS[n]!
    const units = ['', '十', '百', '千']
    const ds = String(n).split('').map(Number)
    let out = ''
    let zero = false
    ds.forEach((d, i) => {
      const u = units[ds.length - 1 - i]!
      if (d === 0) {
        zero = out !== ''
        return
      }
      if (zero) out += '零'
      zero = false
      out += (d === 1 && u === '十' && out === '' ? '' : DIGITS[d]) + u
    })
    return out
  })
}

/** Только иероглифы: знаки препинания, пробелы и латиница не сравниваются. */
export function hanziOnly(text: string): string {
  return [...numbersToHanzi(text)].filter((ch) => /[㐀-鿿]/.test(ch)).join('')
}

export type CharMatch = { ch: string; ok: boolean }

/** Какие иероглифы образца нашлись в распознанном (по наибольшей общей подпоследовательности). */
export function compareHanzi(target: string, heard: string): { chars: CharMatch[]; ok: number; total: number } {
  const a = [...hanziOnly(target)]
  const b = [...hanziOnly(heard)]
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
  const chars: CharMatch[] = []
  let i = 0
  let j = 0
  while (i < a.length) {
    if (j < b.length && a[i] === b[j]) {
      chars.push({ ch: a[i]!, ok: true })
      i++
      j++
    } else if (j < b.length && dp[i]![j + 1]! >= dp[i + 1]![j]!) j++
    else chars.push({ ch: a[i++]!, ok: false })
  }
  const ok = chars.filter((c) => c.ok).length
  return { chars, ok, total: a.length }
}

/** Лучший из вариантов распознавания — с наибольшим совпадением. */
export function bestAlternative(target: string, alts: string[]): { heard: string; match: ReturnType<typeof compareHanzi> } | null {
  let best: { heard: string; match: ReturnType<typeof compareHanzi> } | null = null
  for (const heard of alts) {
    const match = compareHanzi(target, heard)
    if (!best || match.ok > best.match.ok) best = { heard, match }
  }
  return best
}
