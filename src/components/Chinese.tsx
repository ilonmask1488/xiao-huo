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

/** Пиньинь со знаками тонов, каждый слог в цвете своего тона. Вход — с цифрами: «ni3 hao3». */
export function Pinyin({ numeric, className }: { numeric: string; className?: string }) {
  const syllables = markSyllables(numeric)
  return (
    <span className={className} lang="zh-Latn-pinyin">
      {syllables.map((s, i) => (
        <span key={i} className={`tone-${s.tone}`}>
          {i > 0 ? ' ' : ''}
          {s.text}
        </span>
      ))}
    </span>
  )
}
