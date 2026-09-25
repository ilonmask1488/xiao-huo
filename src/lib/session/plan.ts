/*
  Раскладка ежедневного «пуска» по блокам. Базовая пропорция — 40 минут:
  разминка 3, повторение 10, новое 12, эхо 10, «скажи сам» 5.
  Для других длительностей минуты делятся пропорционально (метод наибольших остатков),
  каждый блок получает хотя бы 2 минуты.
*/

export type BlockId = 'warmup' | 'review' | 'new' | 'echo' | 'speak'

export type PlannedBlock = { id: BlockId; minutes: number; startsAt: number }

const BASE: [BlockId, number][] = [
  ['warmup', 3],
  ['review', 10],
  ['new', 12],
  ['echo', 10],
  ['speak', 5],
]
const BASE_TOTAL = 40
const MIN_BLOCK = 2

export function planSession(totalMinutes: number): PlannedBlock[] {
  const raw = BASE.map(([id, m]) => ({ id, exact: (m * totalMinutes) / BASE_TOTAL }))
  const minutes = raw.map((b) => Math.max(MIN_BLOCK, Math.floor(b.exact)))
  let left = totalMinutes - minutes.reduce((a, b) => a + b, 0)

  const byRemainder = raw
    .map((b, i) => ({ i, rem: b.exact - Math.floor(b.exact) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (let k = 0; left > 0; k = (k + 1) % byRemainder.length, left--) minutes[byRemainder[k]!.i]! += 1
  // Если минимум в 2 минуты перебрал бюджет — забираем у самых длинных блоков.
  while (left < 0) {
    const longest = minutes.indexOf(Math.max(...minutes))
    minutes[longest]! -= 1
    left++
  }

  let t = 0
  return raw.map((b, i) => {
    const block = { id: b.id, minutes: minutes[i]!, startsAt: t }
    t += minutes[i]!
    return block
  })
}
