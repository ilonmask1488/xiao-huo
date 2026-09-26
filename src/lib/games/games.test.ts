import { describe, expect, it } from 'vitest'
import { rng } from '../lesson/build'
import { gameAvailable, gameMaterial, pairWeightFor, shooterDelay, shooterTimeLimit, weekStart, weightedPick } from './games'
import { classifySwipe, type Point } from './swipe'

const line = (from: Point, to: Point, n = 8): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n }))

describe('жесты «Тон-тира»', () => {
  it('тап — нейтральный', () => {
    expect(classifySwipe([{ x: 100, y: 100 }, { x: 104, y: 103 }])).toBe(5)
  })
  it('вправо ровно — 1-й', () => {
    expect(classifySwipe(line({ x: 0, y: 100 }, { x: 150, y: 110 }))).toBe(1)
  })
  it('вверх-вправо — 2-й', () => {
    expect(classifySwipe(line({ x: 0, y: 200 }, { x: 120, y: 80 }))).toBe(2)
  })
  it('вниз-вправо — 4-й', () => {
    expect(classifySwipe(line({ x: 0, y: 50 }, { x: 120, y: 190 }))).toBe(4)
  })
  it('«ямка» ∨ — 3-й', () => {
    const pts = [...line({ x: 0, y: 100 }, { x: 60, y: 180 }), ...line({ x: 60, y: 180 }, { x: 130, y: 110 })]
    expect(classifySwipe(pts)).toBe(3)
  })
  it('влево работает так же, как вправо', () => {
    expect(classifySwipe(line({ x: 200, y: 200 }, { x: 80, y: 80 }))).toBe(2)
    expect(classifySwipe(line({ x: 200, y: 100 }, { x: 40, y: 100 }))).toBe(1)
  })
  it('пусто — ничего', () => {
    expect(classifySwipe([])).toBeNull()
  })
})

describe('материал игр', () => {
  it('без пройденных уроков игры закрыты', () => {
    const m = gameMaterial(new Set())
    expect(gameAvailable('shooter', m)).toBe(false)
    expect(gameAvailable('pingpong', m)).toBe(false)
    expect(gameAvailable('twins', m)).toBe(false)
  })
  it('после первого урока открыт «Тон-тир» только с 1-м и 4-м тоном', () => {
    const m = gameMaterial(new Set(['s0-u1-l1']))
    expect(gameAvailable('shooter', m)).toBe(true)
    expect(m.shooter.tones).toEqual([1, 4])
    expect(m.shooter.syllables.every((s) => /[14]$/.test(s))).toBe(true)
  })
  it('«Пинг-понг» — после урока тоновых пар, «Близнецы» — после урока с минимальными парами', () => {
    const m = gameMaterial(new Set(['s0-u4-l1', 's0-u3-l1']))
    expect(gameAvailable('pingpong', m)).toBe(true)
    expect(gameAvailable('twins', m)).toBe(true)
  })
})

describe('правила игр', () => {
  it('слабые пары выпадают чаще, фокусная — ещё чаще', () => {
    const w = new Map([['11', 1], ['25', 4]])
    expect(pairWeightFor('w-pengyou', w)).toBe(4)
    expect(pairWeightFor('w-feiji', w, '11')).toBe(4)
    const r = rng(7)
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 2000; i++) counts[weightedPick(['a', 'b'] as const, (x) => (x === 'b' ? 4 : 1), r)]++
    expect(counts.b).toBeGreaterThan(counts.a * 2.5)
  })
  it('не повторяет только что прозвучавшее', () => {
    const r = rng(1)
    for (let i = 0; i < 50; i++) expect(weightedPick(['a', 'b'], () => 1, r, 'a')).toBe('b')
  })
  it('темп растёт, но не бесконечно', () => {
    expect(shooterDelay(0)).toBeGreaterThan(shooterDelay(5))
    expect(shooterDelay(100)).toBe(250)
    expect(shooterTimeLimit(100)).toBe(2500)
  })
  it('неделя начинается с понедельника', () => {
    expect(weekStart('2026-09-26')).toBe('2026-09-21') // суббота → понедельник
    expect(weekStart('2026-09-21')).toBe('2026-09-21')
    expect(weekStart('2026-09-27')).toBe('2026-09-21') // воскресенье
  })
})
