/*
  Экраны диалога: реплика персонажа (его голосом) и твой ответ — выбрать верную реплику,
  сказать её вслух, при желании записать себя и сравнить с образцом.
*/
import { useEffect, useState } from 'react'
import { Hanzi } from '../../components/Chinese'
import { PlayButton } from '../../components/Play'
import { RecordCompare } from '../../components/RecordCompare'
import ui from '../../components/ui.module.css'
import { characterById, dialogueById, sentenceById } from '../../content'
import { ru } from '../../i18n/ru'
import { playItem, stopAudio } from '../../lib/audio/audio'
import { sfx } from '../../lib/audio/sfx'
import type { HanziMode } from '../../lib/db/types'
import type { Screen } from '../../lib/lesson/build'
import { useSettings } from '../../lib/settings/settings'
import { voiceFor } from '../../lib/story/story'
import { ExerciseHead } from './ExerciseHead'
import s from './lesson.module.css'
import { SentenceLine } from './phrases'
import type { ScreenResult } from './screens'

type Props<K extends Screen['kind']> = {
  screen: Extract<Screen, { kind: K }>
  hanziMode: HanziMode
  onDone: (r: ScreenResult) => void
}

function Speaker({ id }: { id: string }) {
  const c = characterById.get(id)
  if (!c) return null
  return (
    <span className={s.speaker} data-me={id === 'me' || undefined}>
      <Hanzi className={s.speakerHanzi}>{c.hanzi}</Hanzi>
      <span className={s.speakerRu}>{id === 'me' ? ru.dialogue.me : c.ru.split(' — ')[0]}</span>
    </span>
  )
}

function Bubble({ speaker, sentenceId, hanziMode, showRu }: { speaker: string; sentenceId: string; hanziMode: HanziMode; showRu: boolean }) {
  const sen = sentenceById.get(sentenceId)
  if (!sen) return null
  return (
    <div className={s.bubbleWrap} data-me={speaker === 'me' || undefined}>
      <Speaker id={speaker} />
      <div className={s.bubble}>
        <SentenceLine sentence={sen} hanziMode={hanziMode} tappable />
        {showRu && <span className={s.bubbleRu}>{sen.ru}</span>}
      </div>
    </div>
  )
}

/** Предыдущая реплика — контекст для ответа. */
function Context({ dialogueId, index, hanziMode }: { dialogueId: string; index: number; hanziMode: HanziMode }) {
  const prev = dialogueById.get(dialogueId)?.lines[index - 1]
  if (!prev) return null
  return <Bubble speaker={prev.speaker} sentenceId={prev.sentenceId} hanziMode={hanziMode} showRu={false} />
}

export function LineView({ screen, hanziMode, onDone }: Props<'line'>) {
  const settings = useSettings()
  const voice = voiceFor(screen.speaker, settings.voice)
  const [showRu, setShowRu] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => void playItem(screen.sentenceId, { voice }).catch(() => {}), 300)
    return () => {
      clearTimeout(t)
      stopAudio()
    }
  }, [screen.sentenceId, voice])
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.dialogueBody}`}>
        <ExerciseHead kind="line" />
        <Context dialogueId={screen.dialogueId} index={screen.index} hanziMode={hanziMode} />
        <Bubble speaker={screen.speaker} sentenceId={screen.sentenceId} hanziMode={hanziMode} showRu={showRu} />
        <div className={s.row} style={{ flex: 'none', justifyContent: 'center' }}>
          <PlayButton item={screen.sentenceId} voice={voice} label={ru.lesson.listenAgain} size="s" />
          <button type="button" className={ui.link} onClick={() => setShowRu((v) => !v)} aria-pressed={showRu}>
            {showRu ? ru.dialogue.hideRu : ru.dialogue.showRu}
          </button>
        </div>
      </div>
      <div className={s.actions}>
        <button type="button" className={ui.primary} onClick={() => onDone({})}>
          {ru.lesson.next}
        </button>
      </div>
    </div>
  )
}

export function ReplyView({ screen, hanziMode, onDone }: Props<'reply'>) {
  const settings = useSettings()
  const voice = voiceFor('me', settings.voice)
  const [given, setGiven] = useState<string | null>(null)
  const [hintRu, setHintRu] = useState(false)
  const correct = given === screen.sentenceId
  const right = sentenceById.get(screen.sentenceId)
  useEffect(() => () => stopAudio(), [])
  const choose = (id: string) => {
    if (given) return
    setGiven(id)
    sfx(id === screen.sentenceId ? 'correct' : 'wrong')
    void playItem(screen.sentenceId, { voice }).catch(() => {})
  }
  return (
    <div className={s.view}>
      <div className={`${s.body} ${s.dialogueBody}`}>
        <Context dialogueId={screen.dialogueId} index={screen.index} hanziMode={hanziMode} />
        <ExerciseHead kind="reply" title={given ? (correct ? ru.dialogue.sayIt : ru.dialogue.rightWas) : undefined} />
        {!given ? (
          <div className={s.replies} data-dialogue={screen.dialogueId} data-line={screen.index}>
            {screen.options.map((id) => {
              const sen = sentenceById.get(id)
              return sen ? (
                <button key={id} type="button" className={s.replyBtn} data-sentence={id} onClick={() => choose(id)}>
                  <SentenceLine sentence={sen} hanziMode={hanziMode} />
                  {hintRu && <span className={s.replyRu}>{sen.ru}</span>}
                </button>
              ) : null
            })}
          </div>
        ) : (
          <>
            <Bubble speaker="me" sentenceId={screen.sentenceId} hanziMode={hanziMode} showRu />
            <div className={s.feedback} data-kind={correct ? 'right' : 'wrong'} role="status">
              <span className={s.feedbackTitle}>{correct ? ru.lesson.correct : ru.dialogue.notThis(sentenceById.get(given)?.ru ?? '')}</span>
              <span className={s.feedbackLine}>{ru.lesson.nowRepeat}</span>
              <PlayButton item={screen.sentenceId} voice={voice} label={ru.lesson.listenAgain} size="s" />
              <RecordCompare item={screen.sentenceId} voice={voice} compact />
            </div>
          </>
        )}
        {right && !given && (
          <>
            <span className={s.hintRu}>{ru.dialogue.hint}</span>
            <button type="button" className={`${ui.link} ${s.hintLink}`} onClick={() => setHintRu((v) => !v)} aria-pressed={hintRu}>
              {hintRu ? ru.dialogue.hideHintRu : ru.dialogue.hintRu}
            </button>
          </>
        )}
      </div>
      <div className={s.actions}>
        {given && (
          <button
            type="button"
            className={ui.primary}
            onClick={() =>
              onDone({
                correct,
                spoken: true,
                answer: { kind: 'reply', item: screen.sentenceId, expected: screen.sentenceId, given, correct },
              })
            }
          >
            {ru.lesson.saidIt}
          </button>
        )}
      </div>
    </div>
  )
}
