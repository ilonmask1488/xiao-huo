import { describe, expect, it } from 'vitest'
import { content, lessonById } from '../../content'
import type { Lesson } from '../../content/types'
import { bossBreakdown, weakest } from './boss'
import { buildLesson, interleave, longestRun, MAX_RUN, shuffle, type Screen } from './build'

const g = (n: number): Screen[] => Array.from({ length: n }, (_, i) => ({ kind: 'guessTone', syl: `ma${(i % 4) + 1}`, choices: [1, 4] }))
const r = (n: number): Screen[] => Array.from({ length: n }, () => ({ kind: 'repeat', item: 'ma1' }))
const l = (n: number): Screen[] => Array.from({ length: n }, () => ({ kind: 'listen', series: ['ma1', 'ma4'] }))

describe('сборка урока', () => {
  it('во всех уроках контента не больше 3 одинаковых экранов подряд', () => {
    for (const lesson of content.lessons) {
      expect(longestRun(buildLesson(lesson)), lesson.id).toBeLessThanOrEqual(MAX_RUN)
    }
  })

  it('перемешивание сохраняет все экраны и порядок внутри части', () => {
    const out = interleave([l(4), g(10), r(2)])
    expect(out).toHaveLength(16)
    expect(longestRun(out)).toBeLessThanOrEqual(3)
    const guesses = out.filter((s) => s.kind === 'guessTone').map((s) => (s as { syl: string }).syl)
    expect(guesses).toEqual(g(10).map((s) => (s as { syl: string }).syl))
  })

  it('длинная часть разбавляется короткими', () => {
    const out = interleave([g(9), r(2), l(1)])
    expect(longestRun(out)).toBeLessThanOrEqual(3)
  })

  it('объяснения делят урок на разделы и остаются на своих местах', () => {
    const lesson: Lesson = {
      id: 't',
      unitId: 'u',
      order: 1,
      title: 't',
      newWords: [],
      parts: [
        { type: 'explain', title: 'A', body: ['a'] },
        { type: 'repeat', items: ['ma1', 'ma2'] },
        { type: 'explain', title: 'B', body: ['b'] },
        { type: 'guessTone', items: ['ma1', 'ma4'], choices: [1, 4] },
      ],
    }
    expect(buildLesson(lesson).map((s) => s.kind)).toEqual(['explain', 'repeat', 'repeat', 'explain', 'guessTone', 'guessTone'])
  })

  it('урок 0.1.1 начинается с объяснения и содержит все типы упражнений этапа', () => {
    const screens = buildLesson(lessonById.get('s0-u1-l1')!)
    expect(screens[0]!.kind).toBe('explain')
    expect(new Set(screens.map((s) => s.kind))).toEqual(new Set(['explain', 'repeat', 'listen', 'guessTone', 'read']))
  })

  it('итог босса по навыкам и самое слабое место', () => {
    const boss = buildLesson(lessonById.get('s0-u6-l1')!)
    const results: Record<string, boolean> = {}
    boss.forEach((s, i) => {
      if (s.kind === 'guessTone') results[i] = true
      if (s.kind === 'guessPair') results[i] = i % 2 === 0
      if (s.kind === 'whichSyllable') results[i] = s.contrast.skill === 'final'
    })
    const b = bossBreakdown(boss, results)
    expect(b.map((x) => x.skill)).toEqual(['tones', 'initials', 'finals', 'pairs'])
    expect(b.find((x) => x.skill === 'tones')).toMatchObject({ correct: 8, total: 8 })
    expect(weakest(b)).toBe('initials')
    expect(weakest([{ skill: 'tones', correct: 3, total: 3 }])).toBeNull()
  })

  it('перемешивание детерминировано', () => {
    expect(shuffle([1, 2, 3, 4, 5], 42)).toEqual(shuffle([1, 2, 3, 4, 5], 42))
    expect(shuffle([1, 2, 3, 4, 5], 42).sort()).toEqual([1, 2, 3, 4, 5])
  })
})
