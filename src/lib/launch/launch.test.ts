import { describe, expect, it } from 'vitest'
import { longestRun } from '../lesson/build'
import { blockScreens, learnedMaterial, planLaunch, refreshPlan } from './launch'

const D = '2026-09-26'

describe('пуск фазы 1', () => {
  it('первый день: только новый урок, остальное пропускается', () => {
    const plan = planLaunch(new Set(), D)
    expect(plan.map((b) => [b.id, b.status])).toEqual([
      ['warmup', 'skipped'],
      ['review', 'skipped'],
      ['new', 'pending'],
      ['echo', 'skipped'],
      ['speak', 'skipped'],
    ])
    expect(plan.find((b) => b.id === 'new')!.lessonId).toBe('s0-u1-l1')
  })

  it('после первого урока: разминка по пройденным тонам, эхо и чтение', () => {
    const done = new Set(['s0-u1-l1'])
    const plan = planLaunch(done, D)
    expect(plan.find((b) => b.id === 'warmup')!.status).toBe('pending')
    expect(plan.find((b) => b.id === 'new')!.lessonId).toBe('s0-u1-l2')
    const warm = blockScreens('warmup', learnedMaterial(done), D)
    expect(warm.length).toBeGreaterThan(4)
    // в первом уроке были только 1-й и 4-й тоны — и спрашиваем только их
    for (const s of warm) expect(s).toMatchObject({ kind: 'guessTone', choices: [1, 4] })
  })

  it('блоки разные в разные дни, но стабильны в течение дня', () => {
    const l = learnedMaterial(new Set(['s0-u1-l1', 's0-u1-l2', 's0-u1-l3']))
    expect(blockScreens('echo', l, D)).toEqual(blockScreens('echo', l, D))
    expect(blockScreens('echo', l, D)).not.toEqual(blockScreens('echo', l, '2026-09-27'))
  })

  it('«скажи сам» не ставит больше 3 одинаковых экранов подряд и включает слова', () => {
    const l = learnedMaterial(new Set(['s0-u1-l1', 's0-u1-l2', 's0-u1-l3']))
    const s = blockScreens('speak', l, D)
    expect(s.some((x) => x.kind === 'read' && x.item.startsWith('w-'))).toBe(true)
  })

  it('план обновляется в течение дня: сделанное и пропущенное вручную не трогаем', () => {
    const morning = planLaunch(new Set(), D)
    const afterLesson = planLaunch(new Set(['s0-u1-l1']), D)
    const userSkipped = morning.map((b) => (b.id === 'echo' ? { ...b, status: 'skipped' as const, auto: false } : b))
    const withDone = userSkipped.map((b) => (b.id === 'new' ? { ...b, status: 'done' as const } : b))
    const r = refreshPlan(withDone, afterLesson)
    expect(r.find((b) => b.id === 'warmup')!.status).toBe('pending') // материал появился
    expect(r.find((b) => b.id === 'echo')!.status).toBe('skipped') // пропущен вручную
    expect(r.find((b) => b.id === 'new')!).toMatchObject({ status: 'done', lessonId: 's0-u1-l1' })
  })

  it('разминка не длиннее 12 вопросов', () => {
    const l = learnedMaterial(new Set(['s0-u1-l1', 's0-u1-l2', 's0-u1-l3']))
    expect(blockScreens('warmup', l, D).length).toBeLessThanOrEqual(12)
    expect(longestRun(blockScreens('echo', l, D))).toBeGreaterThan(0)
  })
})
