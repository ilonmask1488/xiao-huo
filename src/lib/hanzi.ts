/* Адрес данных порядка черт знака (public/hanzi, см. scripts/hanzi_data.ts). */
export function hanziDataUrl(ch: string): string {
  return `${import.meta.env.BASE_URL}hanzi/${ch.codePointAt(0)!.toString(16)}.json`
}

/** Иероглифы строки (без знаков препинания и латиницы). */
export function hanziChars(text: string): string[] {
  return [...text].filter((ch) => /[㐀-鿿]/.test(ch))
}