/*
  Прогресс уроков: где остановился, что пройдено, какой урок следующий.
*/
import { lessonById, lessonOrder, unitById } from '../../content'
import { db } from '../db/db'
import type { LessonProgressRow } from '../db/types'

export async function getLessonProgress(lessonId: string): Promise<LessonProgressRow | undefined> {
  return db.lessonProgress.get(lessonId)
}

/** Сохранить текущий экран (чтобы можно было выйти и продолжить). */
export async function saveLessonStep(
  lessonId: string,
  step: number,
  results: Record<string, boolean>,
  addSeconds: number,
): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.lessonProgress, async () => {
    const cur = (await db.lessonProgress.get(lessonId)) ?? {
      lessonId,
      step: 0,
      results: {},
      startedAt: now,
      updatedAt: now,
      seconds: 0,
      timesCompleted: 0,
    }
    await db.lessonProgress.put({ ...cur, step, results, updatedAt: now, seconds: cur.seconds + addSeconds })
  })
}

/** Начать прохождение заново (прошлые завершения сохраняются). */
export async function resetLessonRun(lessonId: string): Promise<void> {
  const cur = await db.lessonProgress.get(lessonId)
  if (cur) await db.lessonProgress.put({ ...cur, step: 0, results: {}, seconds: 0, startedAt: Date.now() })
}

/** Урок завершён: отметить, обновить прогресс этапа. */
export async function completeLesson(lessonId: string, accuracy: number | null): Promise<void> {
  const now = Date.now()
  const lesson = lessonById.get(lessonId)
  await db.transaction('rw', db.lessonProgress, db.unitProgress, async () => {
    const cur = await db.lessonProgress.get(lessonId)
    const row: LessonProgressRow = {
      lessonId,
      step: 0,
      results: {},
      startedAt: cur?.startedAt ?? now,
      updatedAt: now,
      seconds: 0,
      completedAt: now,
      timesCompleted: (cur?.timesCompleted ?? 0) + 1,
      bestAccuracy: Math.max(cur?.bestAccuracy ?? 0, accuracy ?? 0),
    }
    await db.lessonProgress.put(row)
    if (!lesson) return
    const unit = unitById.get(lesson.unitId)
    if (!unit) return
    const done = await db.lessonProgress.where('lessonId').anyOf(unit.lessons).filter((p) => !!p.completedAt).count()
    await db.unitProgress.put({
      unitId: unit.id,
      lessonsDone: done,
      completedAt: done >= unit.lessons.length ? now : undefined,
    })
  })
}

export async function completedLessonIds(): Promise<Set<string>> {
  const rows = await db.lessonProgress.filter((p) => !!p.completedAt).toArray()
  return new Set(rows.map((r) => r.lessonId))
}

/** Первый непройденный урок курса. */
export function nextLessonId(completed: Set<string>): string | undefined {
  return lessonOrder.find((l) => !completed.has(l.id))?.id
}
