import { afterEach, describe, expect, it, vi } from 'vitest'
import { bestAlternative, compareHanzi, hanziOnly, listen, numbersToHanzi, recognitionSupported } from './recognize'

afterEach(() => vi.unstubAllGlobals())

describe('распознавание речи (бета)', () => {
  it('без Web Speech API функция скрыта', () => {
    expect(recognitionSupported()).toBe(false)
    vi.stubGlobal('window', { webkitSpeechRecognition: class {} })
    expect(recognitionSupported()).toBe(true)
  })

  it('числа цифрами → иероглифами', () => {
    expect(numbersToHanzi('现在3点')).toBe('现在三点')
    expect(numbersToHanzi('我25岁')).toBe('我二十五岁')
    expect(numbersToHanzi('10个人')).toBe('十个人')
    expect(numbersToHanzi('105')).toBe('一百零五')
    expect(numbersToHanzi('2026年')).toBe('二千零二十六年')
    expect(numbersToHanzi('电话0123')).toBe('电话零一二三')
  })

  it('сравниваются только иероглифы', () => {
    expect(hanziOnly('你好！我叫 Sasha。')).toBe('你好我叫')
    const r = compareHanzi('你好！我叫萨沙。', '你好我叫沙沙')
    expect(r.total).toBe(6)
    expect(r.ok).toBe(5)
    expect(r.chars.map((c) => c.ok)).toEqual([true, true, true, true, false, true])
  })

  it('из вариантов выбирается лучший', () => {
    const best = bestAlternative('现在三点。', ['现在山点', '现在3点'])
    expect(best?.heard).toBe('现在3点')
    expect(best?.match.ok).toBe(4)
    expect(bestAlternative('你好', [])).toBeNull()
  })

  it('Safari: только промежуточный результат и нет конца — берём последний промежуточный', async () => {
    vi.useFakeTimers()
    let inst: { onresult: ((e: unknown) => void) | null } | null = null
    vi.stubGlobal('window', {
      webkitSpeechRecognition: class {
        onresult = null
        onerror = null
        onend = null
        constructor() {
          inst = this
        }
        start() {}
        stop() {}
        abort() {}
      },
    })
    const l = listen()
    const res = (items: string[]) => ({ results: [Object.assign(items.map((transcript) => ({ transcript })), { length: items.length })] })
    inst!.onresult!(res(['你好']))
    inst!.onresult!(res(['你好我叫萨沙']))
    l.stop()
    await vi.advanceTimersByTimeAsync(1600)
    expect(await l.result).toEqual(['你好我叫萨沙'])
    vi.useRealTimers()
  })
})