/*
  Манифест звуков (генерирует scripts/generate_audio.py) и выбор файла для слога или слова.
  Файлы лежат в public/audio, имена с хэшем содержимого — кэш офлайна не устаревает.
*/
import manifestJson from '../../../public/audio/manifest.json'
import { sentenceById, sentenceText, wordById } from '../../content'
import type { Item } from '../../content/types'

export type Voice = 'native' | 'female' | 'male'
export type AudioEntry = { file: string; source: string; ms: number; voice?: Voice; tts?: string }
export type AudioSource = { name: string; url: string; license: string; credit: string }

type Manifest = {
  version: number
  sources: Record<string, AudioSource>
  syllables: Record<string, AudioEntry>
  texts: Record<string, AudioEntry[]>
}

export const manifest = manifestJson as Manifest

const BASE = `${import.meta.env.BASE_URL}audio/`

export function urlOf(entry: AudioEntry): string {
  return BASE + entry.file
}

export function isWordItem(item: Item): boolean {
  return item.startsWith('w-')
}

export function isSentenceItem(item: Item): boolean {
  return item.startsWith('s-')
}

/** Все записи для слога, слова или фразы (у слова — носитель и два голоса TTS). */
export function entriesFor(item: Item): AudioEntry[] {
  if (isWordItem(item)) {
    const w = wordById.get(item)
    return w ? (manifest.texts[w.hanzi] ?? []) : []
  }
  if (isSentenceItem(item)) {
    const s = sentenceById.get(item)
    return s ? (manifest.texts[sentenceText(s)] ?? []) : []
  }
  const e = manifest.syllables[item]
  return e ? [e] : []
}

/**
  Запись для воспроизведения. Для слов: по умолчанию живой носитель, если есть,
  иначе голос из настроек; `voice` — выбрать конкретный.
*/
export function entryFor(item: Item, prefer: 'female' | 'male', voice?: Voice): AudioEntry | undefined {
  const all = entriesFor(item)
  if (!all.length) return undefined
  if (voice) return all.find((e) => e.voice === voice) ?? all[0]
  return all.find((e) => e.voice === 'native') ?? all.find((e) => e.voice === prefer) ?? all[0]
}

/** Текст для запасного синтеза в браузере (только у слов есть иероглифы). */
export function fallbackText(item: Item): string | undefined {
  if (isWordItem(item)) return wordById.get(item)?.hanzi
  if (isSentenceItem(item)) {
    const s = sentenceById.get(item)
    return s ? sentenceText(s) : undefined
  }
  return undefined
}

export function hasAudio(item: Item): boolean {
  return entriesFor(item).length > 0
}
