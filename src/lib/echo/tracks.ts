/*
  Дорожки плеера «Эхо» (ТЗ §5.5): фразы этапа, диалог-босс этапа, эпизоды «Командировки».
  Пройденное — этапы, где закончен хоть один урок, и открытые эпизоды; остальное лежит в «Впереди».
*/
import { dialogueById, episodes, lessonById, sentenceById, units } from '../../content'
import type { SentenceId } from '../../content/types'
import { episodeStates } from '../story/story'

export type EchoLine = { sentenceId: SentenceId; speaker?: string }
export type EchoTrack = {
  id: string
  kind: 'phrases' | 'dialogue' | 'episode'
  title: string
  /** «1.3» или «Эпизод 2» — подпись в списке */
  label: string
  lines: EchoLine[]
  learned: boolean
}

/** Фразы этапа в порядке уроков, без реплик диалога-босса. */
export function unitPhrases(unitId: string): SentenceId[] {
  const unit = units.find((u) => u.id === unitId)
  if (!unit) return []
  const out = new Set<SentenceId>()
  for (const id of unit.lessons) {
    const lesson = lessonById.get(id)
    if (!lesson || lesson.boss) continue
    for (const p of lesson.parts) {
      if (p.type === 'explain') p.sentences?.forEach((s) => out.add(s))
      if (p.type === 'sentences' || p.type === 'assemble') p.items.forEach((s) => out.add(s))
    }
  }
  return [...out].filter((s) => sentenceById.has(s))
}

function dialogueLines(id: string): EchoLine[] {
  // У реплик «me» с вариантами звучит только верный ответ.
  return (dialogueById.get(id)?.lines ?? []).map((l) => ({ sentenceId: l.sentenceId, speaker: l.speaker }))
}

export function echoTracks(completed: Set<string>): EchoTrack[] {
  const out: EchoTrack[] = []
  for (const u of units) {
    const learned = u.lessons.some((l) => completed.has(l))
    const phrases = unitPhrases(u.id)
    if (phrases.length >= 3) {
      out.push({ id: `phrases-${u.id}`, kind: 'phrases', title: u.title, label: u.code, lines: phrases.map((s) => ({ sentenceId: s })), learned })
    }
    for (const d of u.dialogues) {
      const dlg = dialogueById.get(d)
      if (!dlg) continue
      out.push({ id: `dialogue-${d}`, kind: 'dialogue', title: dlg.title, label: u.code, lines: dialogueLines(d), learned })
    }
  }
  const states = new Map(episodeStates(completed).map((e) => [e.id, e]))
  for (const ep of episodes) {
    const st = states.get(ep.id)
    out.push({
      id: `episode-${ep.id}`,
      kind: 'episode',
      title: ep.title,
      label: String(ep.n),
      lines: dialogueLines(ep.dialogueId),
      learned: !!(st?.open || st?.done),
    })
  }
  return out.filter((t) => t.lines.length > 0)
}

/** Автопауза «твоя очередь»: время фразы × 1,2 с поправкой на скорость. */
export function autopauseMs(sampleMs: number, rate: number): number {
  return Math.round((sampleMs * 1.2) / rate)
}
