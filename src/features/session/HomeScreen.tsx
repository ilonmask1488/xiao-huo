/*
  «Сегодня» (UX §2.2): где я в курсе, занятие на сегодня простыми словами и одна главная кнопка,
  ниже — следующий урок курса для тех, кто хочет учиться вне занятия. Маскот — внизу, маленький.
*/
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Hanzi, Pinyin } from '../../components/Chinese'
import { Mascot } from '../../components/Mascot'
import { Banner } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { lessonById, unitById } from '../../content'
import { ru } from '../../i18n/ru'
import { downloadBackup, shouldRemindBackup } from '../../lib/backup/backup'
import { db } from '../../lib/db/db'
import type { LaunchSegment } from '../../lib/db/types'
import { getTodayLaunch, lessonTitle, segmentUrl } from '../../lib/launch/launch'
import { completedLessonIds, nextLessonId } from '../../lib/lesson/progress'
import { detectPlatform, isStandalone, useInstallPrompt } from '../../lib/pwa/install'
import { computeStreak, localDate } from '../../lib/progress/streak'
import { useSettings } from '../../lib/settings/settings'
import s from './HomeScreen.module.css'

const INSTALL_HINT_PAUSE_MS = 14 * 24 * 60 * 60 * 1000

/** Блоки занятия простыми словами: «Повторить 12 слов», «Новый урок „Семья“»… */
function planLines(segments: LaunchSegment[]): { block: LaunchSegment['block']; text: string; done: boolean }[] {
  const t = ru.home.plan
  const byBlock = new Map<LaunchSegment['block'], LaunchSegment[]>()
  for (const seg of segments) byBlock.set(seg.block, [...(byBlock.get(seg.block) ?? []), seg])
  return [...byBlock].map(([block, segs]) => {
    const items = segs.reduce((n, x) => n + (x.items?.length ?? 0), 0)
    const first = segs[0]!
    const text =
      first.kind === 'game'
        ? t.game((ru.games as unknown as Record<string, { title?: string }>)[first.game ?? '']?.title ?? '')
        : first.kind === 'lesson'
          ? t.lesson(lessonTitle(first.lessonId) ?? '')
          : first.kind === 'cards'
            ? t.cards(items)
            : first.kind === 'echo'
              ? t.echo(items)
              : t.speak(items)
    return { block, text, done: segs.every((x) => x.status !== 'pending') }
  })
}

export function HomeScreen() {
  const navigate = useNavigate()
  const settings = useSettings()
  const t = ru.home
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void getTodayLaunch(settings.sessionMinutes).then(() => setReady(true))
  }, [settings.sessionMinutes])
  const row = useLiveQuery(() => (ready ? db.launches.get(localDate()) : undefined), [ready])
  const state = useLiveQuery(async () => {
    const days = await db.days.toArray()
    const completed = await completedLessonIds()
    const next = nextLessonId(completed)
    return { streak: computeStreak(new Map(days.map((d) => [d.date, d.seconds])), localDate()).days, next }
  }, [])
  const [greeting] = useState(() => ru.greetings[dayOfYear() % ru.greetings.length]!)

  const nextLesson = state?.next ? lessonById.get(state.next) : undefined
  const nextUnit = nextLesson ? unitById.get(nextLesson.unitId) : undefined
  const segments = row?.segments ?? []
  const pending = segments.find((x) => x.status === 'pending')
  const started = (row?.seconds ?? 0) > 0 || segments.some((x) => x.status !== 'pending')
  const minutes = segments.reduce((n, x) => n + x.minutes, 0)
  const lines = planLines(segments)

  return (
    <main className={`${s.home} graph-paper`}>
      <header className={s.head}>
        <h1>{t.title}</h1>
        <p className={s.where}>
          {nextUnit ? t.atUnit(nextUnit.code, nextUnit.title) : t.courseDone} · {t.streak(state?.streak ?? 0)}
        </p>
      </header>

      <HomeBanners />

      <section className={s.card} aria-labelledby="today-session">
        <h2 id="today-session">{t.sessionTitle}</h2>
        {row?.segments ? (
          <>
            <ul className={s.plan}>
              {lines.map((l) => (
                <li key={l.block} className={s.planLine} data-done={l.done || undefined}>
                  <span className={s.planMark} aria-hidden>
                    {l.done ? '✓' : '•'}
                  </span>
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
            <p className={s.time}>{pending ? t.sessionTime(minutes) : t.doneHint}</p>
            <Link to="/session" className={s.details}>
              {t.details}
            </Link>
          </>
        ) : (
          <p className={s.time}>…</p>
        )}
      </section>

      <section className={s.next} aria-labelledby="next-lesson">
        <h2 id="next-lesson">{t.nextLessonTitle}</h2>
        {nextLesson && nextUnit ? (
          <>
            <p className={s.nextTitle}>
              <span className="mono">{nextUnit.code}</span> · {nextLesson.title}
            </p>
            <p className={s.hint}>{t.nextLessonHint}</p>
            <button type="button" className={`${ui.secondary} ${s.nextBtn}`} onClick={() => navigate(`/lesson/${nextLesson.id}`)}>
              {t.openLesson}
            </button>
          </>
        ) : (
          <p className={s.hint}>{t.allLessonsDone}</p>
        )}
      </section>

      <section className={s.hero} aria-label={ru.mascot.name}>
        <Mascot mood="happy" size={56} />
        <div>
          <p className={s.bubble}>{greeting}</p>
          <p className={s.name}>
            <Hanzi>{ru.mascot.hanzi}</Hanzi> <Pinyin numeric={ru.mascot.pinyin} /> · {ru.mascot.name}
          </p>
        </div>
      </section>

      <div className={s.launch}>
        {pending ? (
          <button type="button" className={ui.primary} onClick={() => navigate(segmentUrl(pending))}>
            {started ? t.continue : t.start}
          </button>
        ) : row?.segments ? (
          <>
            <p className={s.doneLabel}>{t.done}</p>
            <button type="button" className={ui.secondary} onClick={() => navigate('/train')}>
              {t.train}
            </button>
          </>
        ) : null}
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
