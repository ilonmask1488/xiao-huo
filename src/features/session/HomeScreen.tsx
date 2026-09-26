import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hanzi, Pinyin } from '../../components/Chinese'
import { Mascot } from '../../components/Mascot'
import { Banner } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { ru } from '../../i18n/ru'
import { downloadBackup, shouldRemindBackup } from '../../lib/backup/backup'
import { db } from '../../lib/db/db'
import { detectPlatform, isStandalone, useInstallPrompt } from '../../lib/pwa/install'
import { computeStreak, localDate } from '../../lib/progress/streak'
import { planSession } from '../../lib/session/plan'
import { useSettings } from '../../lib/settings/settings'
import s from './HomeScreen.module.css'

const INSTALL_HINT_PAUSE_MS = 14 * 24 * 60 * 60 * 1000

export function HomeScreen() {
  const navigate = useNavigate()
  const settings = useSettings()
  const plan = planSession(settings.sessionMinutes)
  const telemetry = useLiveQuery(async () => {
    const days = await db.days.toArray()
    const streak = computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate())
    return { days: streak.days, dv: days.reduce((sum, d) => sum + d.dv, 0), cards: await db.cards.count() }
  }, [])
  const reviewLater = (telemetry?.cards ?? 0) === 0
  const [greeting] = useState(() => ru.greetings[dayOfYear() % ru.greetings.length]!)

  return (
    <main className={`${s.home} graph-paper`}>
      <h1 className="visually-hidden">{ru.nav.launch}</h1>
      <div className={`${s.telemetry} mono`}>
        <span>{ru.home.orbitDays(telemetry?.days ?? 0)}</span>
        <span>
          <span style={{ fontFamily: 'var(--font-text)' }}>{ru.home.dv}</span> <strong>{telemetry?.dv ?? 0}</strong> м/с
        </span>
      </div>

      <HomeBanners />

      <section className={s.hero} aria-label={ru.mascot.name}>
        <Mascot mood="happy" size={92} />
        <p className={s.bubble}>{greeting}</p>
      </section>

      <div className={s.name}>
        <Hanzi className={s.nameHanzi}>{ru.mascot.hanzi}</Hanzi>
        <span className={s.namePinyin}>
          <Pinyin numeric={ru.mascot.pinyin} /> · {ru.mascot.name}
        </span>
        <span className={s.nameNote}>{ru.home.sandhiNote}</span>
      </div>

      <section className={s.timeline}>
        <h2>{ru.home.timelineTitle(settings.sessionMinutes)}</h2>
        <div className={s.bar} aria-hidden>
          {plan.map((b) => (
            <span key={b.id} className={s.segment} style={{ flexGrow: b.minutes }} />
          ))}
        </div>
        <ol className={s.rows}>
          {plan.map((b) => (
            <li key={b.id} className={s.row} data-later={(b.id === 'review' && reviewLater) || undefined}>
              <span className={`${s.t} mono`}>T+{String(b.startsAt).padStart(2, '0')}</span>
              <span>
                <span className={s.blockTitle}>{ru.blocks[b.id].title}</span>
                <span className={s.blockWhat}>{b.id === 'review' && reviewLater ? ru.launch.reviewLater : ru.blocks[b.id].what}</span>
              </span>
              <span className={`${s.min} mono`}>{b.minutes} мин</span>
            </li>
          ))}
        </ol>
      </section>

      <div className={s.launch}>
        <button type="button" className={ui.primary} onClick={() => navigate('/session')}>
          {ru.home.start}
        </button>
        <span className={s.launchHint}>{ru.home.startHint}</span>
      </div>
    </main>
  )
}

function HomeBanners() {
  const meta = useLiveQuery(async () => ({
    firstLaunchAt: await db.getMeta<number>('firstLaunchAt'),
    lastBackupAt: await db.getMeta<number>('lastBackupAt'),
    backupDismissedAt: await db.getMeta<number>('backupReminderDismissedAt'),
    installDismissedAt: await db.getMeta<number>('installHintDismissedAt'),
    now: Date.now(),
  }))
  const install = useInstallPrompt()
  if (!meta) return null

  const { now } = meta
  const platform = detectPlatform()
  const showInstall =
    !isStandalone() &&
    (platform !== 'desktop' || install.canPrompt) &&
    now - (meta.installDismissedAt ?? 0) >= INSTALL_HINT_PAUSE_MS
  const showBackup = shouldRemindBackup(now, meta.firstLaunchAt, meta.lastBackupAt, meta.backupDismissedAt)
  if (!showInstall && !showBackup) return null

  const installText =
    platform === 'ios'
      ? ru.banners.installIos
      : install.canPrompt
        ? ru.banners.installAndroid
        : ru.banners.installGeneric

  return (
    <div className={s.banners}>
      {showInstall && (
        <Banner
          action={install.canPrompt ? ru.banners.install : undefined}
          onAction={() => void install.prompt()}
          onClose={() => void db.setMeta('installHintDismissedAt', Date.now())}
        >
          {installText}
        </Banner>
      )}
      {showBackup && (
        <Banner
          action={ru.banners.backupAction}
          onAction={() => void downloadBackup()}
          onClose={() => void db.setMeta('backupReminderDismissedAt', Date.now())}
        >
          {ru.banners.backup}
        </Banner>
      )}
    </div>
  )
}

function dayOfYear(d = new Date()): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000)
}
