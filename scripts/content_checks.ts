import type { Content, LessonPart } from '../src/content/types.ts'

export type ContentReport = { errors: string[]; warnings: string[]; unreviewed: number; total: number }

type AudioIndex = { syllables: Set<string>; texts: Set<string> }

const SYL = /^[a-zv]+[1-5]$/
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']

/** «zhang1» → { initial: 'zh', final: 'ang', tone: 1 } */
export function splitSyllable(syl: string): { initial: string; final: string; tone: number } {
  const tone = Number(syl.slice(-1))
  const base = syl.slice(0, -1)
  const initial = INITIALS.find((i) => base.startsWith(i)) ?? ''
  return { initial, final: base.slice(initial.length), tone }
}

/**
  Структурные проверки контента.
  hasFile — есть ли файл в public/audio; audio — что есть в манифесте звука.
*/
export function checkContent(c: Content, hasFile: (file: string) => boolean, audio?: AudioIndex): ContentReport {
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
  const lessons = dup('урок', c.lessons.map((l) => l.id))
  const wordHanzi = new Map(c.words.map((w) => [w.id, w.hanzi]))

  for (const u of c.units) {
    for (const id of u.newWords) if (!words.has(id)) errors.push(`этап ${u.id}: нет слова «${id}»`)
    for (const id of u.sentences) if (!sentences.has(id)) errors.push(`этап ${u.id}: нет фразы «${id}»`)
    for (const id of u.dialogues) if (!dialogues.has(id)) errors.push(`этап ${u.id}: нет диалога «${id}»`)
    for (const id of u.lessons) if (!lessons.has(id)) errors.push(`этап ${u.id}: нет урока «${id}»`)
    if (u.boss && !dialogues.has(u.boss) && !lessons.has(u.boss)) errors.push(`этап ${u.id}: нет босса «${u.boss}»`)
    for (const g of u.grammarNotes)
      for (const id of g.examples) if (!sentences.has(id)) errors.push(`этап ${u.id}, «${g.title}»: нет фразы «${id}»`)
  }
  const wordPinyin = new Map(c.words.map((w) => [w.id, w.pinyin]))
  for (const s of c.sentences) {
    if (!s.id.startsWith('s-')) errors.push(`фраза ${s.id}: id должен начинаться с «s-»`)
    if (!units.has(s.unitId)) errors.push(`фраза ${s.id}: нет этапа «${s.unitId}»`)
    if (audio && !audio.texts.has(s.tokens.map((t) => t.hanzi).join('')))
      errors.push(`фраза ${s.id}: нет звука — запусти scripts/generate_audio.py`)
    for (const a of s.audio ?? []) if (!hasFile(a.file)) errors.push(`фраза ${s.id}: нет файла ${a.file}`)
    for (const t of s.tokens) {
      if (t.wordId && !words.has(t.wordId)) errors.push(`фраза ${s.id}: нет слова «${t.wordId}»`)
      const syl = t.pinyin.trim().split(/\s+/).filter(Boolean)
      if (syl.some((x) => !SYL.test(x))) errors.push(`фраза ${s.id}: пиньинь «${t.pinyin}» у «${t.hanzi}» не в формате ni3`)
      if (syl.length && syl.length !== [...t.hanzi].length)
        errors.push(`фраза ${s.id}: у «${t.hanzi}» ${[...t.hanzi].length} иероглифа, а слогов ${syl.length}`)
      // Токен-слово пишется так же, как в словаре (нейтральный тон в речи допускается).
      const dict = t.wordId ? wordPinyin.get(t.wordId) : undefined
      if (dict && dict !== t.pinyin && dict.replace(/[1-5]/g, '') !== t.pinyin.replace(/[1-5]/g, ''))
        errors.push(`фраза ${s.id}: «${t.hanzi}» — ${t.pinyin}, а в словаре ${dict}`)
    }
  }
  for (const d of c.dialogues) {
    if (!units.has(d.unitId)) errors.push(`диалог ${d.id}: нет этапа «${d.unitId}»`)
    for (const l of d.lines) if (!sentences.has(l.sentenceId)) errors.push(`диалог ${d.id}: нет фразы «${l.sentenceId}»`)
  }
  for (const w of c.words) {
    if (!w.id.startsWith('w-')) errors.push(`слово ${w.id}: id должен начинаться с «w-»`)
    if (audio && !audio.texts.has(w.hanzi)) errors.push(`слово ${w.id} (${w.hanzi}): нет звука — запусти scripts/generate_audio.py`)
    if (w.audio && !hasFile(w.audio)) errors.push(`слово ${w.id}: нет файла ${w.audio}`)
    if (w.example && !sentences.has(w.example)) errors.push(`слово ${w.id}: нет фразы-примера «${w.example}»`)
    // Слово из таблицы тоновых пар (метка «pair:13») обязано иметь именно эти тоны.
    const cell = w.tags.find((t) => t.startsWith('pair:'))?.slice(5)
    if (cell) {
      const tones = w.pinyin
        .trim()
        .split(/\s+/)
        .map((s) => s.match(/[1-5]$/)?.[0] ?? '5')
        .join('')
      if (tones !== cell) errors.push(`слово ${w.id} (${w.hanzi}): в ячейке ${cell}, а тоны ${tones}`)
    }
  }

  // Уроки: ссылки, звук каждого слога и слова, минимальные пары, тоновые пары.
  const checkItem = (where: string, item: string) => {
    if (item.startsWith('w-')) {
      if (!words.has(item)) errors.push(`${where}: нет слова «${item}»`)
      else if (audio && !audio.texts.has(wordHanzi.get(item)!)) errors.push(`${where}: нет звука слова ${item}`)
    } else if (item.startsWith('s-')) {
      if (!sentences.has(item)) errors.push(`${where}: нет фразы «${item}»`)
    } else if (!SYL.test(item)) errors.push(`${where}: «${item}» — не слог с тоном`)
    else if (audio && !audio.syllables.has(item)) errors.push(`${where}: нет звука слога ${item}`)
  }
  for (const l of c.lessons) {
    if (!units.has(l.unitId)) errors.push(`урок ${l.id}: нет этапа «${l.unitId}»`)
    for (const id of l.newWords) if (!words.has(id)) errors.push(`урок ${l.id}: нет слова «${id}»`)
    l.parts.forEach((p, i) => checkPart(`урок ${l.id}, часть ${i + 1} (${p.type})`, p, checkItem, errors, c))
  }
  if (c.lessons.length) {
    const inUnits = new Set(c.units.flatMap((u) => u.lessons))
    for (const l of c.lessons) if (!inUnits.has(l.id)) warnings.push(`урок ${l.id} не входит ни в один этап`)
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

function checkPart(
  where: string,
  p: LessonPart,
  checkItem: (where: string, item: string) => void,
  errors: string[],
  c: Content,
): void {
  switch (p.type) {
    case 'explain':
      p.examples?.forEach((e) => checkItem(where, e.syl))
      p.words?.forEach((w) => checkItem(where, w))
      p.sandhi?.forEach((w) => checkItem(where, w))
      p.sentences?.forEach((s) => checkItem(where, s))
      if (p.body.length > 4) errors.push(`${where}: больше 4 абзацев — это «стена текста»`)
      break
    case 'listen':
      p.series.flat().forEach((i) => checkItem(where, i))
      break
    case 'repeat':
    case 'read':
      p.items.forEach((i) => checkItem(where, i))
      break
    case 'guessTone':
      for (const s of p.items) {
        checkItem(where, s)
        if (!p.choices.includes(Number(s.slice(-1)) as 1)) errors.push(`${where}: тона слога ${s} нет среди вариантов`)
      }
      break
    case 'whichSyllable':
      for (const it of p.items) {
        checkItem(where, it.answer)
        it.options.forEach((o) => checkItem(where, o))
        if (!it.options.includes(it.answer)) errors.push(`${where}: ответа ${it.answer} нет среди вариантов`)
        // Минимальная пара: варианты различаются только заявленным признаком.
        const parts = it.options.map(splitSyllable)
        const same = (k: 'initial' | 'final' | 'tone') => parts.every((x) => x[k] === parts[0]![k])
        const skill = p.contrast.skill
        const others = (['initial', 'final', 'tone'] as const).filter((k) => k !== skill)
        if (same(skill)) errors.push(`${where}: варианты ${it.options.join('/')} не различаются по признаку «${skill}»`)
        for (const k of others) {
          // ü после j/q/x/y пишется как u — сравниваем финали с учётом этого
          if (k === 'final' && !same('final')) {
            const norm = parts.map((x) => (/^[jqxy]$/.test(x.initial) ? x.final.replace(/^u/, 'v') : x.final))
            if (norm.every((f) => f === norm[0])) continue
          }
          if (!same(k)) errors.push(`${where}: варианты ${it.options.join('/')} различаются не только по «${skill}», но и по «${k}»`)
        }
      }
      break
    case 'meaning':
      for (const w of p.items) {
        if (!w.startsWith('w-')) errors.push(`${where}: «угадай значение» только для слов, а тут ${w}`)
        checkItem(where, w)
      }
      break
    case 'sentences':
    case 'sayIt':
      p.items.forEach((i) => checkItem(where, i))
      break
    case 'assemble':
      for (const id of p.items) {
        checkItem(where, id)
        const s = c.sentences.find((x) => x.id === id)
        const n = s ? s.tokens.filter((t) => t.pinyin.trim()).length : 0
        if (s && n < 2) errors.push(`${where}: во фразе ${id} меньше 2 слов — собирать нечего`)
        if (s && n > 8) errors.push(`${where}: во фразе ${id} ${n} слов — для сборки слишком длинно`)
      }
      break
    case 'guessPair':
      for (const w of p.items) {
        checkItem(where, w)
        const word = c.words.find((x) => x.id === w)
        if (word && word.pinyin.trim().split(/\s+/).length !== 2) errors.push(`${where}: ${w} — не двусложное слово`)
      }
      break
  }
}
