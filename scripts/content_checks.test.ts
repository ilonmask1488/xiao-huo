import { describe, expect, it } from 'vitest'
import type { Content } from '../src/content/types.ts'
import { checkContent } from './content_checks.ts'

const base = (): Content => ({
  units: [
    {
      id: 'u1',
      stage: 1,
      order: 1,
      title: 'Знакомство',
      goals: [],
      newWords: ['w-ni'],
      sentences: ['s1'],
      dialogues: [],
      grammarNotes: [],
      boss: '',
    },
  ],
  words: [{ id: 'w-ni', hanzi: '你', pinyin: 'ni3', ru: ['ты'], tags: [], audio: 'ni.mp3', reviewed: false }],
  sentences: [
    {
      id: 's1',
      tokens: [{ hanzi: '你', pinyin: 'ni3', wordId: 'w-ni' }],
      ru: 'ты',
      audio: [{ voice: 'f', file: 's1.mp3' }],
      unitId: 'u1',
      reviewed: true,
    },
  ],
  dialogues: [],
})

describe('проверка контента', () => {
  it('корректный контент без ошибок', () => {
    const r = checkContent(base(), () => true)
    expect(r.errors).toEqual([])
    expect(r).toMatchObject({ unreviewed: 1, total: 2 })
  })

  it('битая ссылка и нет аудио — ошибки', () => {
    const c = base()
    c.units[0]!.newWords.push('w-missing')
    const r = checkContent(c, (f) => f !== 's1.mp3')
    expect(r.errors).toContain('этап u1: нет слова «w-missing»')
    expect(r.errors).toContain('фраза s1: нет файла s1.mp3')
  })

  it('слово из будущего этапа — предупреждение i+1, если не помечено как новое', () => {
    const c = base()
    c.words.push({ id: 'w-hao', hanzi: '好', pinyin: 'hao3', ru: ['хорошо'], tags: [], audio: 'hao.mp3', reviewed: false })
    c.sentences[0]!.tokens.push({ hanzi: '好', pinyin: 'hao3', wordId: 'w-hao' })
    expect(checkContent(c, () => true).warnings).toHaveLength(1)
    c.sentences[0]!.newWordIds = ['w-hao']
    expect(checkContent(c, () => true).warnings).toHaveLength(0)
  })
})
