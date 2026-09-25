import { describe, expect, it } from 'vitest'
import { planSession } from './plan'

describe('раскладка пуска по блокам', () => {
  it('40 минут — базовая раскладка из ТЗ', () => {
    expect(planSession(40).map((b) => b.minutes)).toEqual([3, 10, 12, 10, 5])
  })

  it.each([20, 30, 40, 45])('%i минут: сумма сходится, блоки не короче 2 минут, время старта растёт', (total) => {
    const plan = planSession(total)
    expect(plan.reduce((s, b) => s + b.minutes, 0)).toBe(total)
    expect(Math.min(...plan.map((b) => b.minutes))).toBeGreaterThanOrEqual(2)
    plan.forEach((b, i) => expect(b.startsAt).toBe(i === 0 ? 0 : plan[i - 1]!.startsAt + plan[i - 1]!.minutes))
  })

  it('порядок блоков постоянный', () => {
    expect(planSession(20).map((b) => b.id)).toEqual(['warmup', 'review', 'new', 'echo', 'speak'])
  })
})
