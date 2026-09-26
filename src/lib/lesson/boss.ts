/*
  Итог «босса» (предстартового теста): точность по навыкам и самое слабое место.
*/
import type { Screen } from './build'

export type Skill = 'tones' | 'initials' | 'finals' | 'pairs'
export type SkillScore = { skill: Skill; correct: number; total: number }

export function skillOf(s: Screen): Skill | null {
  if (s.kind === 'guessTone') return 'tones'
  if (s.kind === 'guessPair') return 'pairs'
  if (s.kind === 'whichSyllable') return s.contrast.skill === 'initial' ? 'initials' : s.contrast.skill === 'final' ? 'finals' : 'tones'
  return null
}

export function bossBreakdown(screens: Screen[], results: Record<string, boolean>): SkillScore[] {
  const by = new Map<Skill, SkillScore>()
  screens.forEach((s, i) => {
    const skill = skillOf(s)
    if (!skill || results[i] === undefined) return
    const cur = by.get(skill) ?? { skill, correct: 0, total: 0 }
    cur.total++
    if (results[i]) cur.correct++
    by.set(skill, cur)
  })
  const order: Skill[] = ['tones', 'initials', 'finals', 'pairs']
  return order.map((k) => by.get(k)).filter((x): x is SkillScore => !!x)
}

export function weakest(scores: SkillScore[]): Skill | null {
  let worst: SkillScore | null = null
  for (const s of scores) {
    if (s.correct === s.total) continue
    if (!worst || s.correct / s.total < worst.correct / worst.total) worst = s
  }
  return worst?.skill ?? null
}

/** Куда вести тренировать слабое место. */
export function trainingFor(skill: Skill): string {
  if (skill === 'tones') return '/game/shooter'
  if (skill === 'pairs') return '/game/pingpong'
  return '/game/twins'
}
