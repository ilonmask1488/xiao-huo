/*
  «Распознать (бета)»: что услышал сервис распознавания и какие иероглифы совпали.
  Нет Web Speech API — кнопки нет. Первый раз объясняем, куда уходит звук и что тоны не проверяются.
*/
import { useEffect, useRef, useState } from 'react'
import { sentenceById, sentenceText, wordById } from '../content'
import type { Item } from '../content/types'
import { ru } from '../i18n/ru'
import { stopAudio } from '../lib/audio/audio'
import { isSentenceItem, isWordItem } from '../lib/audio/manifest'
import { db } from '../lib/db/db'
import { bestAlternative, listen, recognitionSupported, type CharMatch, type Listening } from '../lib/speech/recognize'
import { Hanzi } from './Chinese'
import s from './SpeechCheck.module.css'
import ui from './ui.module.css'

type Result = { heard: string; chars: CharMatch[]; ok: number; total: number } | 'nothing' | 'failed'

function targetOf(item: Item): string | null {
  if (isSentenceItem(item)) {
    const sen = sentenceById.get(item)
    return sen ? sentenceText(sen) : null
  }
  if (isWordItem(item)) return wordById.get(item)?.hanzi ?? null
  return null // отдельный слог распознавание угадывает наугад — не предлагаем
}

export function SpeechCheck({ item, onBusy }: { item: Item; onBusy?: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'explain' | 'listening'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const session = useRef<Listening | null>(null)
  const target = targetOf(item)

  useEffect(() => {
    setResult(null)
    setPhase('idle')
    return () => session.current?.cancel()
  }, [item])

  if (!target || !recognitionSupported()) return null

  const begin = async () => {
    onBusy?.()
    if (!(await db.getMeta('asrExplained'))) return setPhase('explain')
    void run()
  }

  const run = async () => {
    stopAudio()
    setResult(null)
    try {
      session.current = listen()
      setPhase('listening')
      const alts = await session.current.result
      const best = bestAlternative(target, alts)
      setResult(best && best.heard.trim() ? { heard: best.heard, ...best.match } : 'nothing')
    } catch {
      setResult('failed')
    } finally {
      session.current = null
      setPhase('idle')
    }
  }

  return (
    <div className={s.wrap}>
      {phase === 'explain' && (
        <div className={s.explain} role="dialog" aria-label={ru.asr.explainTitle}>
          <p>{ru.asr.explain}</p>
          <div className={s.row}>
            <button type="button" className={ui.secondary} onClick={() => setPhase('idle')}>
              {ru.asr.notNow}
            </button>
            <button
              type="button"
              className={ui.primary}
              onClick={() => {
                void db.setMeta('asrExplained', true)
                void run()
              }}
            >
              {ru.asr.allow}
            </button>
          </div>
        </div>
      )}
      {phase === 'listening' ? (
        <button type="button" className={`${ui.secondary} ${s.btn}`} data-listening onClick={() => session.current?.stop()}>
          <span className={s.dot} aria-hidden /> {ru.asr.listening} · {ru.asr.stop}
        </button>
      ) : (
        phase === 'idle' && (
          <button type="button" className={`${ui.link} ${s.btn}`} onClick={() => void begin()}>
            {ru.asr.button}
          </button>
        )
      )}
      {result && (
        <div className={s.result} role="status">
          {result === 'nothing' ? (
            <span>{ru.asr.nothing}</span>
          ) : result === 'failed' ? (
            <span>{ru.asr.failed}</span>
          ) : (
            <>
              <span>
                {ru.asr.heard} <Hanzi className={s.heard}>{result.heard}</Hanzi>
              </span>
              <span className={s.chars} lang="zh-CN">
                {result.chars.map((c, i) => (
                  <span key={i} data-ok={c.ok || undefined}>
                    {c.ch}
                  </span>
                ))}
              </span>
              <span className={s.score}>{ru.asr.match(result.ok, result.total)}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
