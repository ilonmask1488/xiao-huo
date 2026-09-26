import { useState } from 'react'
import { Mascot } from '../../components/Mascot'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { playSeries } from '../../lib/audio/audio'
import { detectPlatform } from '../../lib/pwa/install'
import s from './lesson.module.css'

/** Проверка звука: «Послушать mā má mǎ mà» + подсказки. */
export function SoundCheckPanel({ onOk }: { onOk?: () => void }) {
  const t = ru.soundCheck
  const [help, setHelp] = useState(false)
  const [played, setPlayed] = useState(false)
  const ios = detectPlatform() === 'ios'
  return (
    <div className={s.soundCheck}>
      <Mascot mood="thinking" size={80} />
      <p>{t.text}</p>
      <button
        type="button"
        className={ui.primary}
        onClick={() => {
          setPlayed(true)
          void playSeries(['ma1', 'ma2', 'ma3', 'ma4'], 350).catch(() => {})
        }}
      >
        {t.listen}
      </button>
      {ios && <p className={s.help}>{t.iphone}</p>}
      {played && (
        <div className={s.row} style={{ width: '100%' }}>
          <button type="button" className={ui.secondary} onClick={() => setHelp(true)}>
            {t.notHeard}
          </button>
          {onOk && (
            <button type="button" className={ui.secondary} onClick={onOk}>
              {t.heard}
            </button>
          )}
        </div>
      )}
      {help && <p className={s.help}>{t.notHeardHelp}</p>}
    </div>
  )
}

export function SoundCheckScreen() {
  return (
    <Screen title={ru.soundCheck.title} back>
      <SoundCheckPanel />
    </Screen>
  )
}
