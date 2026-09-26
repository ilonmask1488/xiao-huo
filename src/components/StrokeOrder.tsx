/*
  Порядок черт (hanzi-writer, MIT; данные — Make Me a Hanzi, Arphic Public License).
  Анимация всех знаков слова по очереди и режим «напиши сам» пальцем по клеткам.
  Грузится лениво: библиотека нужна только на экране слова.
*/
import HanziWriter, { type CharacterJson } from 'hanzi-writer'
import { useEffect, useRef, useState } from 'react'
import { ru } from '../i18n/ru'
import { hanziChars, hanziDataUrl } from '../lib/hanzi'
import s from './StrokeOrder.module.css'
import ui from './ui.module.css'

const SIZE = 132
const cache = new Map<string, Promise<CharacterJson>>()

function loadChar(ch: string): Promise<CharacterJson> {
  let p = cache.get(ch)
  if (!p) {
    p = fetch(hanziDataUrl(ch)).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json() as Promise<CharacterJson>
    })
    p.catch(() => cache.delete(ch))
    cache.set(ch, p)
  }
  return p
}

function color(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback
}

type Mode = 'idle' | 'animating' | 'quiz' | 'done'

export default function StrokeOrder({ hanzi }: { hanzi: string }) {
  const chars = hanziChars(hanzi)
  const boxes = useRef<(HTMLDivElement | null)[]>([])
  const writers = useRef<HanziWriter[]>([])
  const [strokes, setStrokes] = useState<number[]>([])
  const [failed, setFailed] = useState(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [active, setActive] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    let alive = true
    const opts = {
      width: SIZE,
      height: SIZE,
      padding: 8,
      showOutline: true,
      strokeColor: color('--ink', '#1a1c20'),
      outlineColor: color('--line', '#d9d4c7'),
      drawingColor: color('--flame', '#b8430f'),
      highlightColor: color('--t3', '#1d5fcc'),
      radicalColor: null,
      strokeAnimationSpeed: reduced ? 3 : 1.1,
      delayBetweenStrokes: reduced ? 50 : 180,
      drawingWidth: 18,
      showHintAfterMisses: 2,
      charDataLoader: (ch: string, onLoad: (d: CharacterJson) => void, onError: (e?: unknown) => void) => {
        loadChar(ch).then(onLoad, onError)
      },
      onLoadCharDataError: () => alive && setFailed(true),
    }
    const els = chars.map((_, i) => boxes.current[i]!)
    const created = chars.map((ch, i) => HanziWriter.create(els[i]!, ch, opts))
    writers.current = created
    void Promise.all(chars.map(loadChar)).then(
      (data) => alive && setStrokes(data.map((d) => d.strokes.length)),
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
      created.forEach((w) => w.cancelQuiz())
      els.forEach((b) => b.replaceChildren())
    }
    // chars и reduced выводятся из hanzi и среды — пересоздаём писателей только при смене слова
  }, [hanzi]) // oxlint-disable-line react-hooks/exhaustive-deps

  const animate = async () => {
    setMode('animating')
    writers.current.forEach((w) => w.cancelQuiz())
    for (const w of writers.current) await w.hideCharacter()
    for (let i = 0; i < writers.current.length; i++) {
      setActive(i)
      await new Promise<void>((resolve) => void writers.current[i]!.animateCharacter({ onComplete: () => resolve() }))
    }
    setMode('idle')
  }

  const quiz = (i: number) => {
    writers.current.forEach((w) => w.cancelQuiz())
    setActive(i)
    setMistakes(0)
    setMode('quiz')
    void writers.current[i]!.quiz({
      onMistake: () => setMistakes((n) => n + 1),
      onComplete: () => {
        if (i + 1 < writers.current.length) quiz(i + 1)
        else setMode('done')
      },
    })
  }

  if (failed) return <p className={s.note}>{ru.strokes.failed}</p>
  const t = ru.strokes
  return (
    <div className={s.wrap} data-testid="stroke-order">
      <div className={s.chars}>
        {chars.map((ch, i) => (
          <figure key={i} className={s.cell} data-active={(mode !== 'idle' && active === i) || undefined}>
            <div className={s.box} ref={(el) => void (boxes.current[i] = el)} aria-label={t.aria(ch)} role="img" lang="zh-CN" />
            <figcaption className={s.count}>{strokes[i] ? t.count(strokes[i]!) : ' '}</figcaption>
          </figure>
        ))}
      </div>
      <p className={s.note} aria-live="polite">
        {mode === 'quiz' ? t.quizHint(mistakes) : mode === 'done' ? t.done : t.hint}
      </p>
      <div className={s.row}>
        <button type="button" className={ui.secondary} onClick={() => void animate()} disabled={mode === 'animating'}>
          {t.animate}
        </button>
        <button type="button" className={ui.secondary} onClick={() => quiz(0)} disabled={mode === 'animating'}>
          {mode === 'quiz' || mode === 'done' ? t.again : t.quiz}
        </button>
      </div>
    </div>
  )
}
