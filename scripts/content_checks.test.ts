import { describe, expect, it } from 'vitest'
import type { Content } from '../src/content/types.ts'
import { checkContent, splitSyllable } from './content_checks.ts'

const base = (): Content => ({
  units: [
    {
      id: 'u1',
      stage: 0,
      order: 1,
      code: '1.1',
      title: 'Знакомство',
      goals: [],
      lessons: ['l1'],
      newWords: ['w-ni'],
      sentences: ['s-1'],
      dialogues: [],
      grammarNotes: [],
      boss: '',
    },
  ],
  lessons: [
    {
      id: 'l1',
      unitId: 'u1',
      order: 1,
      title: 'Урок',
      newWords: ['w-ni'],
      parts: [
        { type: 'guessTone', items: ['ma1', 'ma4'], choices: [1, 4] },
        { type: 'whichSyllable', contrast: { label: 'b/p', skill: 'initial' }, items: [{ answer: 'ba4', options: ['ba4', 'pa4'] }] },
      ],
    },
  ],
  words: [{ id: 'w-ni', hanzi: '你', pinyin: 'ni3', ru: ['ты'], tags: [], reviewed: false }],
  sentences: [
    {
      id: 's-1',
      tokens: [{ hanzi: '你', pinyin: 'ni3', wordId: 'w-ni' }],
      ru: 'ты',
      audio: [{ voice: 'f', file: 's1.mp3' }],
      unitId: 'u1',
      reviewed: true,
    },
  ],
  dialogues: [],
})

const audio = { syllables: new Set(['ma1', 'ma4', 'ba4', 'pa4', 'lv4', 'lu4', 'ju1', 'zhi1']), texts: new Set(['你', '好', '你你好']) }

describe('проверка контента', () => {
  it('корректный контент без ошибок', () => {
    const r = checkContent(base(), () => true, audio)
    expect(r.errors).toEqual([])
    expect(r).toMatchObject({ unreviewed: 1, total: 2 })
  })

  it('битая ссылка и нет аудио — ошибки', () => {
    const c = base()
    c.units[0]!.newWords.push('w-missing')
    const r = checkContent(c, (f) => f !== 's1.mp3', audio)
    expect(r.errors).toContain('этап u1: нет слова «w-missing»')
    expect(r.errors).toContain('фраза s-1: нет файла s1.mp3')
  })

  it('у слога урока нет звука — ошибка', () => {
    const c = base()
    c.lessons[0]!.parts.push({ type: 'repeat', items: ['xi1'] })
    expect(checkContent(c, () => true, audio).errors.join()).toMatch(/нет звука слога xi1/)
  })

  it('минимальная пара должна различаться только заявленным признаком', () => {
    const c = base()
    c.lessons[0]!.parts.push({
      type: 'whichSyllable',
      contrast: { label: 'zh/z', skill: 'initial' },
      items: [{ answer: 'zhi1', options: ['zhi1', 'ba4'] }],
    })
    expect(checkContent(c, () => true, audio).errors.join()).toMatch(/различаются не только/)
  })

  it('ü после j/q/x пишется как u — это не лишнее различие', () => {
    expect(splitSyllable('ju1')).toEqual({ initial: 'j', final: 'u', tone: 1 })
    const c = base()
    c.lessons[0]!.parts.push({
      type: 'whichSyllable',
      contrast: { label: 'ü/u', skill: 'final' },
      items: [{ answer: 'lv4', options: ['lv4', 'lu4'] }],
    })
    expect(checkContent(c, () => true, audio).errors).toEqual([])
  })

  it('слово в ячейке тоновой пары обязано иметь эти тоны', () => {
    const c = base()
    c.words.push({ id: 'w-bad', hanzi: '好', pinyin: 'hao3 hao3', ru: ['x'], tags: ['pair:13'], reviewed: false })
    expect(checkContent(c, () => true, audio).errors.join()).toMatch(/в ячейке 13, а тоны 33/)
  })

  it('тон слога должен быть среди вариантов «угадай тон»', () => {
    const c = base()
    c.lessons[0]!.parts.push({ type: 'guessTone', items: ['ma1'], choices: [2, 3] })
    expect(checkContent(c, () => true, audio).errors.join()).toMatch(/нет среди вариантов/)
  })

  it('слово из будущего этапа — предупреждение i+1, если не помечено как новое', () => {
    const c = base()
    c.words.push({ id: 'w-hao', hanzi: '好', pinyin: 'hao3', ru: ['хорошо'], tags: [], reviewed: false })
    c.units.push({ ...c.units[0]!, id: 'u2', order: 2, code: '0.2', lessons: [], newWords: ['w-hao'], sentences: [] })
    c.sentences[0]!.tokens.push({ hanzi: '好', pinyin: 'hao3', wordId: 'w-hao' })
    expect(checkContent(c, () => true, audio).warnings).toHaveLength(1)
    c.sentences[0]!.newWordIds = ['w-hao']
    expect(checkContent(c, () => true, audio).warnings).toHaveLength(0)
  })

  it('диалог-босс: персонажи, ловушки, голоса, эпизод', () => {
    const c = base()
    const u = c.units[0]!
    u.stage = 1
    c.words.push({ id: 'w-hao', hanzi: '好', pinyin: 'hao3', ru: ['хорошо'], tags: [], reviewed: false })
    c.sentences.push({ id: 's-2', tokens: [{ hanzi: '好', pinyin: 'hao3', wordId: 'w-hao' }], ru: 'хорошо', unitId: 'u1', newWordIds: ['w-hao'], reviewed: false })
    c.characters = [
      { id: 'me', hanzi: '萨沙', pinyin: 'sa4 sha1', ru: 'Саша', voice: 'me' },
      { id: 'li', hanzi: '小李', pinyin: 'xiao3 li3', ru: 'Сяо Ли', voice: 'male' },
    ]
    c.dialogues.push({
      id: 'd-1',
      unitId: 'u1',
      title: 'Встреча',
      characters: ['me', 'li'],
      lines: [
        { speaker: 'li', sentenceId: 's-1' },
        { speaker: 'me', sentenceId: 's-2', choices: ['s-1'] },
      ],
    })
    c.lessons.push({ id: 'u1-boss', unitId: 'u1', order: 2, title: 'Босс', newWords: [], parts: [{ type: 'dialogue', id: 'd-1' }], boss: { passPercent: 80 } })
    u.lessons.push('u1-boss')
    u.boss = 'u1-boss'
    u.dialogues = ['d-1']
    c.lessons.push({ id: 'story-1', unitId: 'story', order: 1, title: 'Эпизод', newWords: [], parts: [{ type: 'dialogue', id: 'd-1' }] })
    c.episodes = [{ id: 'ep1', n: 1, title: 'Прилёт', blurb: '', unlockAfter: 'u1', lessonId: 'story-1', dialogueId: 'd-1' }]
    const voices = new Map([
      ['你', new Set(['male'])],
      ['好', new Set(['female', 'male2'])],
    ])
    const full = { ...audio, voices }
    const ok = checkContent(c, () => true, full)
    expect(ok.errors).toEqual([])
    expect(ok.warnings).toEqual([])

    // Нет голоса персонажа, ловушка совпадает с ответом, реплика у неизвестного.
    c.dialogues[0]!.lines[1]!.choices = ['s-2']
    c.dialogues[0]!.lines.push({ speaker: 'boss', sentenceId: 's-1' })
    const bad = checkContent(c, () => true, { ...audio, voices: new Map([['你', new Set(['female'])]]) }).errors.join('\n')
    expect(bad).toMatch(/варианты ответа повторяются/)
    expect(bad).toMatch(/нет персонажа «boss»/)
    expect(bad).toMatch(/нет звука голосом male/)
    expect(bad).toMatch(/нет звука голосом male2/)

    // Босс без диалога.
    c.lessons.find((l) => l.id === 'u1-boss')!.parts = [{ type: 'sentences', items: ['s-1'] }]
    expect(checkContent(c, () => true, full).errors.join()).toMatch(/босс u1-boss без диалога/)
  })
})