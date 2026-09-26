import type { CSSProperties } from 'react'
import { markSyllables } from '../lib/pinyin/marks'

/** Иероглифы — всегда с lang="zh-CN", иначе возможны японские/традиционные начертания. */
export function Hanzi({ children, className, style }: { children: string; className?: string; style?: CSSProperties }) {
  return (
    <span lang="zh-CN" className={className} style={style}>
      {children}
    </span>
  )
}

const CJK = /([㐀-鿿豈-﫿]+)/

/** Русский текст со вставками иероглифов («табличка «萨沙»»): иероглифы получают lang="zh-CN". */
export function MixedText({ text }: { text: string }) {
  const parts = text.split(CJK)
  if (parts.length === 1) return <>{text}</>
  return <>{parts.map((p, i) => (i % 2 ? <Hanzi key={i}>{p}</Hanzi> : p))}</>
}

/**
  Пиньинь со знаками тонов, каждый слог в цвете своего тона. Вход — с цифрами: «ni3 hao3».
  По умолчанию слово пишется слитно, как принято в пиньине (gōngchéngshī, апостроф перед a/o/e: xī'ān);
  joined={false} — для серий отдельных слогов («mā má mǎ mà»).
*/
export function Pinyin({ numeric, className, joined = true }: { numeric: string; className?: string; joined?: boolean }) {
  const syllables = markSyllables(numeric)
  return (
    <span className={className} lang="zh-Latn-pinyin">
      {syllables.map((s, i) => (
        <span key={i} className={`tone-${s.tone}`}>
          {i > 0 ? (joined ? (/^[aoeāáǎàōóǒòēéěè]/i.test(s.text) ? "'" : '') : ' ') : ''}
          {s.text}
        </span>
      ))}
    </span>
  )
}
