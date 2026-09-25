import type { Content } from '../src/content/types.ts'

export type ContentReport = { errors: string[]; warnings: string[]; unreviewed: number; total: number }

/** Структурные проверки контента. hasAudio — есть ли файл в public/audio. */
export function checkContent(c: Content, hasAudio: (file: string) => boolean): ContentReport {
  const errors: string[] = []
  const warnings: string[] = []

  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${kind}: повторяется id «${id}»`)
      seen.add(id)
    }
    return seen
  }
  const words = dup('слово', c.words.map((w) => w.id))
  const sentences = dup('фраза', c.sentences.map((s) => s.id))
  const dialogues = dup('диалог', c.dialogues.map((d) => d.id))
  const units = dup('этап', c.units.map((u) => u.id))

  for (const u of c.units) {
    for (const id of u.newWords) if (!words.has(id)) errors.push(`этап ${u.id}: нет слова «${id}»`)
    for (const id of u.sentences) if (!sentences.has(id)) errors.push(`этап ${u.id}: нет фразы «${id}»`)
    for (const id of u.dialogues) if (!dialogues.has(id)) errors.push(`этап ${u.id}: нет диалога «${id}»`)
    if (u.boss && !dialogues.has(u.boss)) errors.push(`этап ${u.id}: нет диалога-босса «${u.boss}»`)
    for (const g of u.grammarNotes)
      for (const id of g.examples) if (!sentences.has(id)) errors.push(`этап ${u.id}, «${g.title}»: нет фразы «${id}»`)
  }
  for (const s of c.sentences) {
    if (!units.has(s.unitId)) errors.push(`фраза ${s.id}: нет этапа «${s.unitId}»`)
    for (const t of s.tokens) if (t.wordId && !words.has(t.wordId)) errors.push(`фраза ${s.id}: нет слова «${t.wordId}»`)
    if (!s.audio.length) errors.push(`фраза ${s.id}: нет аудио`)
    for (const a of s.audio) if (!hasAudio(a.file)) errors.push(`фраза ${s.id}: нет файла ${a.file}`)
  }
  for (const d of c.dialogues) {
    if (!units.has(d.unitId)) errors.push(`диалог ${d.id}: нет этапа «${d.unitId}»`)
    for (const l of d.lines) if (!sentences.has(l.sentenceId)) errors.push(`диалог ${d.id}: нет фразы «${l.sentenceId}»`)
  }
  for (const w of c.words) {
    if (!w.audio) errors.push(`слово ${w.id} (${w.hanzi}): нет аудио`)
    else if (!hasAudio(w.audio)) errors.push(`слово ${w.id}: нет файла ${w.audio}`)
    if (w.example && !sentences.has(w.example)) errors.push(`слово ${w.id}: нет фразы-примера «${w.example}»`)
  }

  // Правило i+1: фраза этапа использует только слова этого и предыдущих этапов.
  const ordered = [...c.units].sort((a, b) => a.stage - b.stage || a.order - b.order)
  const known = new Set<string>()
  for (const u of ordered) {
    u.newWords.forEach((w) => known.add(w))
    for (const s of c.sentences.filter((x) => x.unitId === u.id)) {
      const allowed = new Set(s.newWordIds ?? [])
      for (const t of s.tokens) {
        if (t.wordId && !known.has(t.wordId) && !allowed.has(t.wordId))
          warnings.push(`фраза ${s.id} (этап ${u.id}): слово «${t.hanzi}» ещё не введено — пометь как новое`)
      }
    }
  }

  const all = [...c.words, ...c.sentences]
  return { errors, warnings, unreviewed: all.filter((x) => !x.reviewed).length, total: all.length }
}
