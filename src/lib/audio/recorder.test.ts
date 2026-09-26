import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickMime, recordingSupported } from './recorder'

afterEach(() => vi.unstubAllGlobals())

describe('запись голоса', () => {
  it('без MediaRecorder функция скрыта, а не ломается', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(recordingSupported()).toBe(false)
    expect(pickMime()).toBeUndefined()
  })

  it('формат: webm/opus, если есть, иначе mp4 (Safari)', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'audio/webm;codecs=opus' || m === 'audio/mp4' })
    expect(pickMime()).toBe('audio/webm;codecs=opus')
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'audio/mp4' })
    expect(pickMime()).toBe('audio/mp4')
  })
})
