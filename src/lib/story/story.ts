/* Персонажи и эпизоды «Командировки». */
import { characterById, episodes, unitById } from '../../content'
import type { Episode } from '../../content/types'
import type { Voice } from '../audio/manifest'

/** Голос персонажа; «me» (стажёр — это ты) говорит голосом из настроек. */
export function voiceFor(speaker: string, settingsVoice: 'female' | 'male'): Voice {
  if (speaker === 'me') return settingsVoice === 'female' ? 'female' : 'male2'
  return (characterById.get(speaker)?.voice as Voice | undefined) ?? 'female'
}

export type EpisodeState = Episode & { open: boolean; done: boolean; unlockTitle: string }

/**
  Эпизод открыт, когда пройдены все уроки этапа unlockAfter.
  Запрета нет: закрытый эпизод можно открыть — просто слов может не хватать.
*/
export function episodeStates(completed: Set<string>): EpisodeState[] {
  return episodes.map((ep) => {
    const unit = unitById.get(ep.unlockAfter)
    const lessons = unit?.lessons.filter((l) => !l.endsWith('-boss')) ?? []
    return {
      ...ep,
      open: lessons.length > 0 && lessons.every((l) => completed.has(l)),
      done: completed.has(ep.lessonId),
      unlockTitle: unit ? `${unit.code} ${unit.title}` : '',
    }
  })
}
