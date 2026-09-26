import { describe, expect, it } from 'vitest'
import { baseOf, pinyinQueryMatcher, syllableToNumeric, toNumeric, tonesOf } from './normalize'
import { applySandhi, hasSandhi, spokenMarked } from './sandhi'

describe('нормализация ввода', () => {
  it.each([
    ['mǎ', 'ma3'],
    ['ma3', 'ma3'],
    ['ma', 'ma'],
    ['lv4', 'lv4'],
    ['lü4', 'lv4'],
    ['lu:4', 'lv4'],
    ['lǜ', 'lv4'],
    ['NǏ', 'ni3'],
    ['xiè', 'xie4'],
  ])('%s → %s', (a, b) => expect(syllableToNumeric(a)).toBe(b))

  it('фраза со знаками и пунктуацией', () => {
    expect(toNumeric('Nǐ hǎo!')).toBe('ni3 hao3')
    expect(toNumeric('zài jiàn')).toBe('zai4 jian4')
  })

  it('тоны и основа слога', () => {
    expect(tonesOf('xie4 xie5')).toEqual([4, 5])
    expect(tonesOf('xie4 xie')).toEqual([4, 5])
    expect(baseOf('lv4')).toBe('lv')
  })
})

describe('поиск по пиньиню', () => {
  const nihao = 'ni3 hao3'
  it.each([
    ['nihao', true],
    ['ni hao', true],
    ['ni3hao3', true],
    ['ni3 hao3', true],
    ['nǐhǎo', true],
    ['nǐ hǎo', true],
    ['ni3hao', true],
    ['hao', true],
    ['hǎo', true],
    ['ni2hao3', false],
    ['nǐháo', false],
    ['hao4', false],
    ['xie', false],
  ])('«%s» в «ni3 hao3» → %s', (q, ok) => expect(pinyinQueryMatcher(q)!(nihao)).toBe(ok))

  it('ü в любом написании', () => {
    for (const q of ['lv', 'lü', 'lǜ', 'lv4', 'lu:4']) expect(pinyinQueryMatcher(q)!('lv4 se4')).toBe(true)
  })

  it('нейтральный тон — цифра 5', () => {
    expect(pinyinQueryMatcher('xiexie')!('xie4 xie5')).toBe(true)
    expect(pinyinQueryMatcher('xie4xie5')!('xie4 xie5')).toBe(true)
  })

  it('без букв — не пиньинь', () => {
    expect(pinyinQueryMatcher('你好')).toBeNull()
    expect(pinyinQueryMatcher('  ')).toBeNull()
  })
})

describe('сандхи', () => {
  it.each([
    ['ni3 hao3', '你好', 'ni2 hao3'],
    ['hen3 hao3', '很好', 'hen2 hao3'],
    ['ke3 yi3', '可以', 'ke2 yi3'],
    ['wo3 hen3 hao3', '我很好', 'wo2 hen2 hao3'],
    ['bu4 shi4', '不是', 'bu2 shi4'],
    ['bu4 yao4', '不要', 'bu2 yao4'],
    ['bu4 hao3', '不好', 'bu4 hao3'],
    ['bu4 lai2', '不来', 'bu4 lai2'],
    ['yi1', '一', 'yi1'],
    ['yi1 ge4', '一个', 'yi2 ge4'],
    ['yi1 tian1', '一天', 'yi4 tian1'],
    ['yi1 nian2', '一年', 'yi4 nian2'],
    ['yi1 qi3', '一起', 'yi4 qi3'],
    ['di4 yi1', '第一', 'di4 yi1'],
    ['shi2 yi1', '十一', 'shi2 yi1'],
    ['yi1 bai3', '一百', 'yi4 bai3'],
    ['yi1 wan4', '一万', 'yi2 wan4'],
    ['yi1 er4 san1', '一二三', 'yi1 er4 san1'],
    ['shi2 yi1 ge4', '十一个', 'shi2 yi1 ge4'],
    ['lao3 shi1', '老师', 'lao3 shi1'],
  ])('%s (%s) → %s', (dict, hanzi, spoken) => expect(applySandhi(dict, hanzi).spoken).toBe(spoken))

  it('bu4 другого иероглифа (部) не меняется', () => {
    expect(applySandhi('bu4 fen4', '部分').spoken).toBe('bu4 fen4')
  })

  it('без иероглифов правила 不 и 一 работают по пиньиню', () => {
    expect(applySandhi('bu4 shi4').spoken).toBe('bu2 shi4')
    expect(applySandhi('yi1 ge4').spoken).toBe('yi2 ge4')
  })

  it('сообщает, какие правила сработали', () => {
    expect(applySandhi('ni3 hao3', '你好').applied).toEqual([{ rule: 'third', index: 0 }])
    expect(applySandhi('bu4 shi4', '不是').applied).toEqual([{ rule: 'bu', index: 0 }])
    expect(hasSandhi('lao3 shi1', '老师')).toBe(false)
  })

  it('произносимый пиньинь со знаками', () => {
    expect(spokenMarked('ni3 hao3', '你好')).toBe('níhǎo')
    expect(spokenMarked('yi1 ge4', '一个')).toBe('yígè')
    expect(spokenMarked('xi1 an1')).toBe("xī'ān")
  })
})
