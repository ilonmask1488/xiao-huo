/*
  Высокоуровневый API звука для экранов: «сыграй слог / слово», серии, предзагрузка.
*/
import type { Item } from '../../content/types'
import { ru } from '../../i18n/ru'
import { loadSettings } from '../settings/settings'
import { entriesFor, entryFor, fallbackText, isSentenceItem, isWordItem, urlOf, type Voice } from './manifest'
import { AudioError, player } from './player'
import { hasChineseVoice, speakChinese } from './speech'

export { player } from './player'

let prefs = { voice: 'female' as 'female' | 'male', rate: 1 as number }
export function configureAudio(p: { voice: 'female' | 'male'; audioRate: number }): void {
  prefs = { voice: p.voice, rate: p.audioRate }
}
void loadSettings()
  .then((s) => configureAudio(s))
  .catch(() => {})

/** Длительность звука в мс (для паузы «твоя очередь»). */
export function durationOf(item: Item, voice?: Voice): number {
  return entryFor(item, prefs.voice, voice)?.ms ?? 800
}

/**
  Сыграть слог или слово. Слоги — всегда на скорости 1.0 (образец тона),
  слова — на скорости из настроек (высота при замедлении сохраняется).
*/
export async function playItem(item: Item, opts: { voice?: Voice; rate?: number } = {}): Promise<void> {
  const entry = entryFor(item, prefs.voice, opts.voice)
  const rate = opts.rate ?? (isWordItem(item) || isSentenceItem(item) ? prefs.rate : 1)
  if (entry) return player.play(urlOf(entry), rate)

  const text = fallbackText(item)
  if (text && (await hasChineseVoice())) return speakChinese(text, rate)
  const msg = text ? ru.audio.noChineseVoice : ru.audio.missing
  player.emitError(msg)
  throw new AudioError(msg)
}

/** Серия с паузой между звуками; прерывается следующей командой play. */
export async function playSeries(items: Item[], gapMs = 350, onStep?: (i: number) => void): Promise<void> {
  const token = ++seriesToken
  for (let i = 0; i < items.length; i++) {
    if (token !== seriesToken) return
    onStep?.(i)
    await playItem(items[i]!)
    if (i < items.length - 1) await wait(gapMs)
  }
  onStep?.(-1)
}
let seriesToken = 0
export function stopAudio(): void {
  seriesToken++
  player.stop()
}

/** Предзагрузить звуки следующих экранов (все голоса слова). */
export function preloadItems(items: Item[]): void {
  player.preload(items.flatMap((i) => entriesFor(i).map(urlOf)))
}

/** Какие голоса есть у слова — для кнопки «другим голосом». */
export function voicesOf(item: Item): Voice[] {
  return entriesFor(item)
    .map((e) => e.voice)
    .filter((v): v is Voice => !!v)
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
