/*
  «Запиши себя и сравни»: образец → я → образец.
  Микрофон спрашивается только при первом нажатии, с объяснением зачем.
*/
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Item } from '../content/types'
import { ru } from '../i18n/ru'
import { playItem, sampleUrl, stopAudio, wait } from '../lib/audio/audio'
import type { Voice } from '../lib/audio/manifest'
import { player } from '../lib/audio/player'
import { recordingSupported, RecorderError, startRecording, type Recording } from '../lib/audio/recorder'
import { db } from '../lib/db/db'
import s from './RecordCompare.module.css'
import { SpeechCheck } from './SpeechCheck'
import ui from './ui.module.css'

const PitchChart = lazy(() => import('./PitchChart'))

type Phase = 'idle' | 'explain' | 'recording' | 'ready' | 'comparing'

const MAX_MS = 12_000

export function RecordCompare({
  item,
  voice,
  compact,
  rate,
  onBusy,
}: {
  item: Item
  voice?: Voice
  compact?: boolean
  /** скорость образца (в «Эхо» можно 0.75) */
  rate?: number
  /** запись или сравнение началось — например, остановить автовоспроизведение */
  onBusy?: () => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const rec = useRef<Recording | null>(null)
  const mine = useRef<string | null>(null)
  const [mineUrl, setMineUrl] = useState<string | null>(null)
  const [chart, setChart] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      rec.current?.cancel()
      if (mine.current) URL.revokeObjectURL(mine.current)
    },
    [],
  )
  // Новая фраза — старая запись больше не нужна.
  useEffect(() => {
    setPhase('idle')
    setError(null)
    if (mine.current) URL.revokeObjectURL(mine.current)
    mine.current = null
    setMineUrl(null)
  }, [item])

  const canRecord = recordingSupported()
  // Для графика — основной голос из настроек: у голосов персонажей (особенно низкого у инженера Вана) тон читается хуже.
  const sample = sampleUrl(item)
  if (!canRecord) return <SpeechCheck item={item} onBusy={onBusy} />

  const begin = async () => {
    setError(null)
    onBusy?.()
    if (!(await db.getMeta('micExplained'))) {
      setPhase('explain')
      return
    }
    await record()
  }

  const record = async () => {
    stopAudio()
    try {
      rec.current = await startRecording()
      setPhase('recording')
      timer.current = setTimeout(() => void stop(), MAX_MS)
    } catch (e) {
      setPhase('idle')
      setError(e instanceof RecorderError && e.reason === 'denied' ? ru.record.denied : e instanceof RecorderError && e.reason === 'no-device' ? ru.record.noDevice : ru.record.failed)
    }
  }

  const stop = async () => {
    clearTimeout(timer.current)
    const r = rec.current
    rec.current = null
    if (!r) return
    try {
      const res = await r.stop()
      if (mine.current) URL.revokeObjectURL(mine.current)
      mine.current = res.url
      setMineUrl(res.url)
      setPhase('ready')
      void compare()
    } catch {
      setPhase('idle')
      setError(ru.record.failed)
    }
  }

  const compare = async () => {
    if (!mine.current) return
    onBusy?.()
    setPhase('comparing')
    try {
      setStep(1)
      await playItem(item, { voice, rate })
      await wait(300)
      setStep(2)
      await player.play(mine.current)
      await wait(300)
      setStep(3)
      await playItem(item, { voice, rate })
    } catch {
      /* ошибку звука покажет плеер */
    } finally {
      setStep(0)
      setPhase('ready')
    }
  }

  return (
    <div className={`${s.wrap} ${compact ? s.compact : ''}`} data-phase={phase}>
      {phase === 'explain' && (
        <div className={s.explain} role="dialog" aria-label={ru.record.explainTitle}>
          <p>{ru.record.explain}</p>
          <div className={s.row}>
            <button type="button" className={ui.secondary} onClick={() => setPhase('idle')}>
              {ru.record.notNow}
            </button>
            <button
              type="button"
              className={ui.primary}
              onClick={() => {
                void db.setMeta('micExplained', true)
                void record()
              }}
            >
              {ru.record.allow}
            </button>
          </div>
        </div>
      )}
      {phase === 'recording' && (
        <button type="button" className={`${ui.primary} ${s.recBtn}`} data-rec onClick={() => void stop()}>
          <span className={s.dot} aria-hidden /> {ru.record.stop}
        </button>
      )}
      {(phase === 'idle' || phase === 'ready' || phase === 'comparing') && (
        <div className={s.row}>
          <button type="button" className={`${ui.secondary} ${s.recBtn}`} onClick={() => void begin()} disabled={phase === 'comparing'}>
            <IconMic /> {phase === 'idle' ? ru.record.record : ru.record.again}
          </button>
          {phase !== 'idle' && (
            <button type="button" className={ui.secondary} onClick={() => void compare()} disabled={phase === 'comparing'}>
              {ru.record.compare}
            </button>
          )}
          {phase !== 'idle' && sample && (
            <button type="button" className={ui.secondary} aria-pressed={chart} onClick={() => setChart((v) => !v)}>
              {chart ? ru.pitch.hide : ru.pitch.show}
            </button>
          )}
        </div>
      )}
      {chart && sample && mineUrl && (phase === 'ready' || phase === 'comparing') && (
        <Suspense fallback={<p className={s.steps}>{ru.pitch.loading}</p>}>
          <PitchChart sampleUrl={sample} mineUrl={mineUrl} />
        </Suspense>
      )}
      {phase !== 'recording' && phase !== 'explain' && <SpeechCheck item={item} onBusy={onBusy} />}
      {phase === 'comparing' && (
        <p className={s.steps} aria-live="polite">
          <span data-on={step === 1 || undefined}>{ru.record.sample}</span> → <span data-on={step === 2 || undefined}>{ru.record.me}</span> →{' '}
          <span data-on={step === 3 || undefined}>{ru.record.sample}</span>
        </p>
      )}
      {error && (
        <p className={s.error} role="status">
          {error}
        </p>
      )}
    </div>
  )
}

function IconMic() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  )
}
