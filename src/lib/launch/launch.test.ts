import { describe, expect, it } from 'vitest'
import { content, lessonOrder } from '../../content'
import type { CardRow, LaunchSegment } from '../db/types'
import { formatOf, longestRun } from '../lesson/build'
import { newCard } from '../srs/srs'
import { MAX_SEGMENT_MINUTES, planSegments, refreshSegments, segmentScreens, warmupGame } from './launch'

const D = '2026-09-26'
const stage0 = lessonOrder.filter((l) => l.unitId.startsWith('s0-')).map((l) => l.id)
const all = lessonOrder.map((l) => l.id)
const words = content.words.map((w) => w.id)

/** Карточки к повторению: по типу 1 для каждого слова, часть — других типов. */
function due(n: number): CardRow[] {
  const kinds = [1, 1, 2, 4, 3] as const
  return Array.from({ length: n }, (_, i) => newCard(words[i % words.length]!, kinds[i % 5]!, 1000 + i))
}

describe('план пуска из сегментов', () => {
  it('первый день: только новый урок', () => {
    const p = planSegments({ minutes: 40, completed: new Set(), due: [], date: D })
    expect(p.map((s) => s.kind)).toEqual(['lesson'])
    expect(p[0]!.lessonId).toBe('s0-u1-l1')
  })

  it('после ступени 0: разминка, повторение, новое, эхо, «скажи сам»', () => {
    const p = planSegments({ minutes: 40, completed: new Set(stage0), due: due(40), date: D })
    expect(p[0]!.kind).toBe('game')
    expect(new Set(p.map((s) => s.block))).toEqual(new Set(['warmup', 'review', 'new', 'echo', 'speak']))
  })

  it.each([20, 30, 40, 45])('%i минут: ни один сегмент (кроме урока и игры) не длиннее ~3 минут', (minutes) => {
    const p = planSegments({ minutes, completed: new Set(stage0), due: due(200), date: D })
    for (const s of p.filter((x) => x.kind !== 'lesson' && x.kind !== 'game')) expect(s.minutes).toBeLessThanOrEqual(MAX_SEGMENT_MINUTES)
  })

  it('соседние сегменты — разного формата, пока есть из чего выбирать', () => {
    const p = planSegments({ minutes: 45, completed: new Set(stage0), due: due(200), date: D })
    for (let i = 1; i < p.length; i++) {
      const rest = new Set(p.slice(i).map((s) => s.kind))
      if (rest.size > 1) expect(p[i]!.kind, `${p[i - 1]!.id} → ${p[i]!.id}`).not.toBe(p[i - 1]!.kind)
    }
  })

  it('общее время плана близко к выбранной длительности', () => {
    const p = planSegments({ minutes: 40, completed: new Set(stage0), due: due(200), date: D })
    const total = p.reduce((s, x) => s + x.minutes, 0)
    expect(total).toBeGreaterThanOrEqual(30)
    expect(total).toBeLessThanOrEqual(46)
  })

  it('повторение ограничено временем блока, даже если карточек сотни', () => {
    const p = planSegments({ minutes: 40, completed: new Set(stage0), due: due(500), date: D })
    const cards = p.filter((s) => s.kind === 'cards').flatMap((s) => s.items ?? [])
    expect(cards.length).toBeLessThanOrEqual(45)
    expect(cards.length).toBeGreaterThan(20)
  })

  it('внутри сегмента повторения — не больше 3 карточек одного типа подряд', () => {
    const cards = due(40)
    const map = new Map(cards.map((c) => [c.id, c]))
    const p = planSegments({ minutes: 40, completed: new Set(stage0), due: cards, date: D })
    for (const s of p.filter((x) => x.kind === 'cards')) {
      const screens = segmentScreens(s, D, map)
      expect(screens.length).toBe(s.items!.length)
      expect(longestRun(screens)).toBeLessThanOrEqual(3)
      expect(screens.every((x) => x.kind === 'card')).toBe(true)
    }
  })

  it('формат карточки зависит от типа: «аудио → значение» и «скажи вслух» — разные форматы', () => {
    expect(formatOf({ kind: 'card', cardId: 'a:1', word: 'w-ni', cardKind: 1 })).not.toBe(
      formatOf({ kind: 'card', cardId: 'a:3', word: 'w-ni', cardKind: 3 }),
    )
  })

  it('когда пройдено всё — «Новое» не планируется, остальное есть', () => {
    const p = planSegments({ minutes: 30, completed: new Set(all), due: due(30), date: D })
    expect(p.some((s) => s.kind === 'lesson')).toBe(false)
    expect(p.some((s) => s.kind === 'cards')).toBe(true)
  })

  it('разминка меняется по дням, но стабильна в течение дня', () => {
    const done = new Set(stage0)
    expect(warmupGame(done, D)).toBe(warmupGame(done, D))
    const games = new Set(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'].map((d) => warmupGame(done, d)))
    expect(games.size).toBeGreaterThan(1)
  })

  it('план обновляется: сделанное и пропущенное вручную не трогаем', () => {
    const morning = planSegments({ minutes: 40, completed: new Set(['s0-u1-l1']), due: [], date: D })
    const done: LaunchSegment[] = morning.map((s) => (s.block === 'warmup' ? { ...s, status: 'done' } : s))
    const skipped = done.map((s) => (s.block === 'echo' ? { ...s, status: 'skipped' as const, auto: false } : s))
    const fresh = planSegments({ minutes: 40, completed: new Set(['s0-u1-l1', 's0-u1-l2']), due: [], date: D })
    const r = refreshSegments(skipped, fresh)
    expect(r.find((s) => s.block === 'warmup')!.status).toBe('done')
    expect(r.filter((s) => s.block === 'echo').every((s) => s.status === 'skipped')).toBe(true)
    expect(r.find((s) => s.block === 'new')!.lessonId).toBe('s0-u1-l3')
  })
})
