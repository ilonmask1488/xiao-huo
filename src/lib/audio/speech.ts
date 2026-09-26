/*
  Запасной вариант — синтез речи браузера (speechSynthesis, zh-CN).
  Только если нужного файла нет. Если китайского голоса нет — понятная подсказка, как его поставить.
*/

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function chineseVoice(): SpeechSynthesisVoice | undefined {
  return speechSynthesis.getVoices().find((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || v.lang === 'zh')
}

/** Голоса грузятся асинхронно — ждём до 1 с. */
export async function hasChineseVoice(): Promise<boolean> {
  if (!speechSupported()) return false
  if (chineseVoice()) return true
  await new Promise<void>((r) => {
    const t = setTimeout(r, 1000)
    speechSynthesis.addEventListener('voiceschanged', () => (clearTimeout(t), r()), { once: true })
  })
  return !!chineseVoice()
}

export function speakChinese(text: string, rate = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!speechSupported()) return reject(new Error('no speechSynthesis'))
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = rate
    const v = chineseVoice()
    if (v) u.voice = v
    u.onend = () => resolve()
    u.onerror = (e) => reject(new Error(e.error))
    speechSynthesis.speak(u)
  })
}
