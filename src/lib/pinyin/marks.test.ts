import { describe, expect, it } from 'vitest'
import { markSyllable, markSyllables, toMarked } from './marks'

describe('расстановка знаков тона', () => {
  it.each([
    ['ma1', 'mā'],
    ['ma2', 'má'],
    ['ma3', 'mǎ'],
    ['ma4', 'mà'],
    ['ma5', 'ma'],
    ['ma', 'ma'],
    ['hao3', 'hǎo'], // a приоритетнее o
    ['xie4', 'xiè'], // e приоритетнее i
    ['lei4', 'lèi'],
    ['dou1', 'dōu'], // ou → на o
    ['liu4', 'liù'], // иначе на последнюю гласную
    ['gui3', 'guǐ'],
    ['huo3', 'huǒ'],
    ['lv4', 'lǜ'],
    ['lu:4', 'lǜ'],
    ['lü4', 'lǜ'],
    ['nv3', 'nǚ'],
    ['lve4', 'lüè'],
    ['er2', 'ér'],
    ['zhi1', 'zhī'],
    ['Ai4', 'Ài'],
    ['Ou1', 'Ōu'],
    ['LV4', 'LǛ'], // заглавная Ü
  ])('%s → %s', (numeric, marked) => {
    expect(markSyllable(numeric).text).toBe(marked)
  })

  it('тон определяется по цифре, без цифры — нейтральный', () => {
    expect(markSyllable('ma3').tone).toBe(3)
    expect(markSyllable('ma').tone).toBe(5)
  })

  it('слог без гласной остаётся без знака', () => {
    expect(markSyllable('ng2').text).toBe('ng')
  })

  it('фраза разбивается по пробелам', () => {
    expect(toMarked('ni3 hao3')).toBe('nǐ hǎo')
    expect(toMarked('  gong1  cheng2 shi1 ')).toBe('gōng chéng shī')
    expect(markSyllables('xiao3 huo3').map((s) => s.tone)).toEqual([3, 3])
  })

  it('мусор — ошибка', () => {
    expect(() => markSyllable('ma9')).toThrow()
    expect(() => markSyllable('你')).toThrow()
  })
})
