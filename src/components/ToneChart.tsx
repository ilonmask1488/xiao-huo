/*
  Контур тона по шкале Чао: уровень 1 (низ) … 5 (верх).
  1 — 55, 2 — 35, 3 — 214, 4 — 51, нейтральный — короткая точка без контура.
*/
import type { Tone } from '../lib/pinyin/marks'
import s from './ToneChart.module.css'

const X0 = 14
const X1 = 68
const y = (level: number) => 46 - (level - 1) * 9.5

export const TONE_CURVES: Record<Tone, string> = {
  1: `M${X0} ${y(5)} L${X1} ${y(5)}`,
  2: `M${X0} ${y(3)} Q${(X0 + X1) / 2} ${y(3) + 2} ${X1} ${y(5)}`,
  3: `M${X0} ${y(2)} Q${X0 + 16} ${y(1) + 6} ${X0 + 22} ${y(1)} T${X1} ${y(4)}`,
  4: `M${X0} ${y(5)} L${X1} ${y(1)}`,
  5: `M${(X0 + X1) / 2 - 5} ${y(2.5)} L${(X0 + X1) / 2 + 5} ${y(2.3)}`,
}

/** Большой график с сеткой уровней 1–5 (для объяснений и тренажёра). */
export function ToneChart({ tones, className }: { tones: Tone[]; className?: string }) {
  return (
    <svg className={`${s.chart} ${className ?? ''}`} viewBox="0 0 72 52" aria-hidden>
      {[1, 2, 3, 4, 5].map((l) => (
        <g key={l}>
          <line className={s.level} x1={X0} x2={X1} y1={y(l)} y2={y(l)} />
          <text className={s.label} x={2} y={y(l) + 2.5}>
            {l}
          </text>
        </g>
      ))}
      {tones.map((t) => (
        <path key={t} className={`${s.curve} tone-${t}`} d={TONE_CURVES[t]} />
      ))}
    </svg>
  )
}

/** Маленький значок тона без сетки — для кнопок ответа. */
export function ToneGlyph({ tone, size = 36 }: { tone: Tone; size?: number }) {
  return (
    <svg className={`${s.glyph} tone-${tone}`} viewBox="8 0 66 52" width={size} height={(size * 52) / 66} aria-hidden>
      <path className={s.curve} d={TONE_CURVES[tone]} />
    </svg>
  )
}
