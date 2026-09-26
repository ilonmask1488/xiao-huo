/*
  Достижения ступени 0. Названия и описания — в ru.ts (achievements).
  Проверяются после урока или игры; новые возвращаются для показа в итогах.
*/
import { db } from '../db/db'
import { computeStreak, localDate } from './streak'

export type AchievementId =
  | 'first-lesson'
  | 'first-nihao'
  | 'yamka'
  | 'twins'
  | 'orbit-3'
  | 'loud-100'
  | 'night'
  | 'stage0'
  | 'third-100'
  | 'no-dip-miss'
  | 'orbit-7'
  | 'words-100'
  | 'loud-1000'

type Check = () => Promise<boolean>

const CHECKS: Record<AchievementId, Check> = {
  'first-lesson': async () => (await db.lessonProgress.filter((p) => !!p.completedAt).count()) > 0,
  'first-nihao': async () => (await db.answers.where('item').equals('w-nihao').filter((a) => a.kind === 'self').count()) > 0,
  yamka: async () =>
    (await db.answers.where('kind').equals('tone').filter((a) => a.expected === '3' && a.correct).count()) >= 50,
  twins: async () => (await db.answers.where('kind').equals('syllable').filter((a) => a.correct).count()) >= 30,
  'orbit-3': async () => {
    const days = await db.days.toArray()
    return computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate()).days >= 3
  },
  'loud-100': async () => (await db.days.toArray()).reduce((s, d) => s + d.spokenCount, 0) >= 100,
  night: async () => {
    const h = new Date().getHours()
    return h >= 23 || h < 4
  },
  stage0: async () => !!(await db.unitProgress.get('s0-u6'))?.completedAt,
  'third-100': async () =>
    (await db.answers.where('kind').equals('tone').filter((a) => a.expected === '3' && a.correct).count()) >= 100,
  // 20 третьих тонов подряд — без единой ошибки
  'no-dip-miss': async () => {
    const thirds = (await db.answers.where('kind').equals('tone').filter((a) => a.expected === '3').sortBy('at')).slice(-20)
    return thirds.length >= 20 && thirds.every((a) => a.correct)
  },
  'orbit-7': async () => {
    const days = await db.days.toArray()
    return computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate()).days >= 7
  },
  'words-100': async () => (await db.cards.where('kind').equals(1).count()) >= 100,
  'loud-1000': async () => (await db.days.toArray()).reduce((s, d) => s + d.spokenCount, 0) >= 1000,
}

export const ACHIEVEMENT_IDS = Object.keys(CHECKS) as AchievementId[]

/** Проверить все ещё не полученные достижения; вернуть новые. */
export async function evaluateAchievements(): Promise<AchievementId[]> {
  const have = new Set((await db.achievements.toArray()).map((a) => a.id))
  const fresh: AchievementId[] = []
  for (const id of ACHIEVEMENT_IDS) {
    if (have.has(id)) continue
    try {
      if (await CHECKS[id]()) fresh.push(id)
    } catch (e) {
      console.error('achievement', id, e)
    }
  }
  if (fresh.length) await db.achievements.bulkPut(fresh.map((id) => ({ id, unlockedAt: Date.now() })))
  return fresh
}
