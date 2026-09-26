/*
  Запись ответов, времени и Δv в базу. Всё, что «считается прогрессом», проходит здесь.
*/
import { db } from '../db/db'
import type { AnswerRow, ToneStatRow } from '../db/types'
import { localDate } from './streak'

/** Ответ + обновление статистики тонов/пар (для тепловой карты и «самого трудного тона»). */
export async function recordAnswer(a: Omit<AnswerRow, 'id' | 'at'>): Promise<void> {
  const row: AnswerRow = { ...a, at: Date.now() }
  await db.transaction('rw', db.answers, db.toneStats, async () => {
    await db.answers.add(row)
    if (a.kind === 'tone' || a.kind === 'pair') {
      const key = a.expected
      const cur: ToneStatRow = (await db.toneStats.get(key)) ?? { pair: key, correct: 0, wrong: 0, confusions: {} }
      if (a.correct) cur.correct++
      else {
        cur.wrong++
        cur.confusions[a.given] = (cur.confusions[a.given] ?? 0) + 1
      }
      await db.toneStats.put(cur)
    }
  })
}

/** Добавить время и Δv к сегодняшнему дню. */
export async function addToday(p: { seconds?: number; dv?: number; spoken?: number; newWords?: number }): Promise<void> {
  const date = localDate()
  await db.transaction('rw', db.days, async () => {
    const d = (await db.days.get(date)) ?? { date, seconds: 0, dv: 0, spokenCount: 0, newWords: 0 }
    d.seconds += Math.round(p.seconds ?? 0)
    d.dv += Math.round(p.dv ?? 0)
    d.spokenCount += p.spoken ?? 0
    d.newWords += p.newWords ?? 0
    await db.days.put(d)
  })
}
