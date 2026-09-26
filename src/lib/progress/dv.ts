/*
  Δv (дельта-v, «м/с») — очки прогресса. Вся формула здесь, чтобы её было легко менять.
  Награждаем за время, точность и — больше всего — за произнесение вслух.
*/

export const DV = {
  perMinute: 2,
  correct: 5,
  /** попытка тоже считается: ошибка — не проигрыш */
  wrong: 1,
  spoken: 4,
  lessonComplete: 25,
  /** за каждое верное подряд после 5 в игре — умножается на множитель комбо */
  comboStep: 1,
  bossPassed: 150,
} as const

export function dvForLesson(r: { seconds: number; correct: number; wrong: number; spoken: number }): number {
  return Math.round(
    (r.seconds / 60) * DV.perMinute + r.correct * DV.correct + r.wrong * DV.wrong + r.spoken * DV.spoken + DV.lessonComplete,
  )
}

export function dvForGame(r: { seconds: number; correct: number; wrong: number; comboBonus: number }): number {
  return Math.round((r.seconds / 60) * DV.perMinute + r.correct * DV.correct + r.wrong * DV.wrong + r.comboBonus * DV.comboStep)
}

/** Множитель комбо: ×2 после 5 верных подряд, ×3 после 10. */
export function comboMultiplier(streak: number): 1 | 2 | 3 {
  return streak >= 10 ? 3 : streak >= 5 ? 2 : 1
}
