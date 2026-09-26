/*
  Распознавание жеста «Тон-тира»: → ровный (1), ↗ вверх (2), ∨ «ямка» (3), ↘ вниз (4), тап — нейтральный (5).
  Экранная ось y смотрит вниз, поэтому «вверх» — это отрицательный dy.
  Горизонтальное направление не важно: свайп влево распознаётся так же, как вправо.
*/
import type { Tone } from '../pinyin/marks'

export type Point = { x: number; y: number }

const TAP = 18 // px: меньше — это касание
const DIP = 16 // px: насколько линия должна провалиться ниже обоих концов, чтобы быть «ямкой»
const SLOPE = 0.35 // |dy|/|dx| меньше — ровно

export function classifySwipe(points: Point[]): Tone | null {
  if (!points.length) return null
  const a = points[0]!
  const b = points[points.length - 1]!
  const dx = Math.abs(b.x - a.x)
  const dy = b.y - a.y
  const maxDist = Math.max(...points.map((p) => Math.hypot(p.x - a.x, p.y - a.y)))
  if (maxDist < TAP) return 5

  // «Ямка»: самая низкая точка заметно ниже и начала, и конца.
  const lowest = Math.max(...points.map((p) => p.y))
  if (lowest - a.y > DIP && lowest - b.y > DIP) return 3

  if (dx < TAP && Math.abs(dy) < TAP) return 5
  const slope = dx === 0 ? Infinity : Math.abs(dy) / dx
  if (slope < SLOPE) return 1
  return dy < 0 ? 2 : 4
}
