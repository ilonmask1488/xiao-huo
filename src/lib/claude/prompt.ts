/*
  Промпт для чата с Claude: этап, известные и трудные слова, слабые тоновые пары, ситуация.
  Встроенного ИИ в приложении нет (ТЗ §12) — промпт копируется в буфер обмена.
*/
import { lessonOrder, unitById, wordById } from '../../content'
import type { Unit } from '../../content/types'
import { CLAUDE_PROMPT } from '../../i18n/claude-prompt'
import { db } from '../db/db'
import { toMarked } from '../pinyin/marks'

export type PromptData = {
  unit: Unit | undefined
  known: string[]
  hard: string[]
  pairs: string[]
}

/** Собрать данные из прогресса. unitId — если нажато на странице этапа. */
export async function collectPromptData(unitId?: string): Promise<PromptData> {
  const done = new Set((await db.lessonProgress.filter((p) => !!p.completedAt).toArray()).map((p) => p.lessonId))
  const doneLessons = lessonOrder.filter((l) => done.has(l.id))
  const current = unitId ? unitById.get(unitId) : unitById.get((lessonOrder.find((l) => !done.has(l.id)) ?? doneLessons.at(-1))?.unitId ?? '')
  const knownIds = [...new Set(doneLessons.flatMap((l) => l.newWords))]
  // Трудные: больше всего ошибок в карточках (lapses) и ответах «не очень»/неверно.
  const cards = await db.cards.toArray()
  const lapses = new Map<string, number>()
  for (const c of cards) lapses.set(c.itemId, (lapses.get(c.itemId) ?? 0) + c.lapses)
  const answers = await db.answers.where('item').startsWith('w-').toArray()
  for (const a of answers) if (!a.correct) lapses.set(a.item, (lapses.get(a.item) ?? 0) + 1)
  const hard = [...lapses].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id)
  const stats = await db.toneStats.toArray()
  const pairs = stats
    .filter((s) => s.pair.length === 2 && s.correct + s.wrong >= 3 && s.wrong > 0)
    .sort((a, b) => b.wrong / (b.correct + b.wrong) - a.wrong / (a.correct + a.wrong))
    .slice(0, 4)
    .map((s) => `${s.pair[0]}+${s.pair[1]}`)
  return { unit: current, known: knownIds, hard, pairs }
}

function wordLabel(id: string): string | null {
  const w = wordById.get(id)
  return w ? `${w.hanzi} (${toMarked(w.pinyin)})` : null
}

export function buildPrompt(d: PromptData, template = CLAUDE_PROMPT): string {
  const known = d.known.map(wordLabel).filter(Boolean)
  const hard = d.hard.map(wordLabel).filter(Boolean)
  const situation = d.unit?.situation ?? d.unit?.title ?? 'знакомство с коллегой'
  return template
    .replaceAll('{unit}', d.unit ? `${d.unit.code} ${d.unit.title}` : 'Стартовый стол')
    .replaceAll('{stage}', String(d.unit?.stage ?? 0))
    .replaceAll('{known}', known.length ? known.join(', ') : 'пока только приветствия')
    .replaceAll('{hard}', hard.length ? hard.join(', ') : 'пока нет')
    .replaceAll('{pairs}', d.pairs.length ? d.pairs.join(', ') : 'пока нет данных')
    .replaceAll('{situation}', situation)
}

/** Скопировать в буфер: Clipboard API, иначе — через выделение текста. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.append(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
