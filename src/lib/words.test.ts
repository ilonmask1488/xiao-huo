import { describe, expect, it } from 'vitest'
import { meaningOf, wordRu } from './words'

describe('формат перевода слова (UX §7)', () => {
  it('значения через «; », пояснение в скобках — после', () => {
    expect(wordRu({ ru: ['быть', 'да, это так'] })).toBe('быть; да, это так')
    expect(wordRu({ ru: ['один (штука)'] })).toBe('один (штука)')
    expect(wordRu({ ru: ['(частица вопроса)', 'ли'] })).toBe('ли (частица вопроса)')
  })
  it('первое значение — без служебных пометок', () => {
    expect(meaningOf({ ru: ['(частица вопроса)', 'ли'] })).toBe('ли')
    expect(meaningOf({ ru: ['(частица)'] })).toBe('(частица)')
    expect(meaningOf({ ru: [] })).toBe('')
  })
})
