/* Статистика (ТЗ §5.7): минуты по дням, серия, слова, удержание FSRS, тоновые пары, прогноз до HSK. */
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Term } from '../../components/Sheet'
import { Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import { ACHIEVEMENT_IDS } from '../../lib/progress/achievements'
import { hskForecast, minutesByDay, wordsByStage, wordsPace } from '../../lib/progress/stats'
import { computeStreak, localDate, ORBIT_DAY_SECONDS } from '../../lib/progress/streak'
import { useSettings } from '../../lib/settings/settings'
import { learnedWordIds, retentionStats } from '../../lib/srs/cards'
import s from './StatsScreen.module.css'

export function StatsScreen() {
  const t = ru.stats
  const settings = useSettings()
  const data = useLiveQuery(async () => {
    const today = localDate()
    const days = await db.days.toArray()
    const learned = await learnedWordIds()
    const stats = await db.toneStats.toArray()
    return {
      today,
      streak: computeStreak(new Map(days.map((d) => [d.date, d.seconds])), today),
      minutes: Math.round(days.reduce((a, d) => a + d.seconds, 0) / 60),
      dv: days.reduce((a, d) => a + d.dv, 0),
      spoken: days.reduce((a, d) => a + d.spokenCount, 0),
      byDay: minutesByDay(days, today),
      learned,
      byStage: wordsByStage(learned),
      pace: wordsPace(days, today),
      retention: await retentionStats(),
      cards: await db.cards.count(),
      weakPairs: stats
        .filter((x) => x.pair.length === 2 && x.correct + x.wrong >= 3)
        .map((x) => ({ pair: x.pair, rate: x.wrong / (x.correct + x.wrong), n: x.correct + x.wrong }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 3),
      got: new Map((await db.achievements.toArray()).map((a) => [a.id, a.unlockedAt])),
    }
  })
  if (!data) return null
  const forecast = hskForecast(data.learned, settings.hskScale, data.pace)

  return (
    <Screen title={t.title} back>
      <div className={s.tiles}>
        <Tile value={data.streak.days} label={<Term k="streak">{t.orbit}</Term>} note={data.streak.reserveUsed ? t.reserveUsed : undefined} />
        <Tile value={data.minutes} label={t.minutes} />
        <Tile value={String(data.dv)} label={<Term k="dv">{t.dv}</Term>} />
        <Tile value={data.spoken} label={t.spoken} />
      </div>

      <section className={s.section}>
        <h2>{t.byDay}</h2>
        <DayChart days={data.byDay} />
        <p className={s.note}>{t.orbitRule}</p>
      </section>

      <section className={s.section}>
        <h2>{t.words}</h2>
        <dl className={s.list}>
          {[0, 1, 2, 3]
            .filter((n) => (data.byStage.get(n) ?? 0) > 0 || n <= 1)
            .map((n) => (
              <div key={n}>
                <dt>{t.stage(n)}</dt>
                <dd className="mono">{data.byStage.get(n) ?? 0}</dd>
              </div>
            ))}
          <div>
            <dt>{t.cards}</dt>
            <dd className="mono">{data.cards}</dd>
          </div>
          <div>
            <dt>{t.retention}</dt>
            <dd className="mono">{data.retention.retention === null ? '—' : `${Math.round(data.retention.retention * 100)}%`}</dd>
          </div>
        </dl>
        <p className={s.note}>{data.retention.retention === null ? t.retentionEmpty : t.retentionNote(Math.round(settings.desiredRetention * 100))}</p>
      </section>

      <section className={s.section}>
        <h2>{t.pairs}</h2>
        {data.weakPairs.length ? (
          <ul className={s.pairs}>
            {data.weakPairs.map((p) => (
              <li key={p.pair}>
                <span className="mono">
                  <span className={`tone-${p.pair[0]}`}>{ru.lesson.toneShort(Number(p.pair[0]))}</span> +{' '}
                  <span className={`tone-${p.pair[1]}`}>{ru.lesson.toneShort(Number(p.pair[1]))}</span>
                </span>
                <span>{ru.tones.errorsOf(p.n, Math.round(p.rate * 100))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.note}>{t.pairsEmpty}</p>
        )}
        <Link to="/tones" className={s.more}>
          {t.toHeatmap}
        </Link>
      </section>

      <section className={s.section}>
        <h2>{t.forecast(settings.hskScale === 'hsk2' ? 'HSK 2.0' : 'HSK 3.0')}</h2>
        <ul className={s.forecast}>
          {forecast.map((f) => (
            <li key={f.level}>
              <div className={s.fcHead}>
                <span>HSK {f.level}</span>
                <span className="mono">
                  {f.have} / {f.need}
                </span>
              </div>
              <div className={s.bar} role="progressbar" aria-valuemin={0} aria-valuemax={f.need} aria-valuenow={f.have} aria-label={`HSK ${f.level}`}>
                <div style={{ width: `${Math.min(100, (f.have / f.need) * 100)}%` }} />
              </div>
              <span className={s.note}>{f.days === 0 ? t.done : f.days === null ? t.noPace : t.daysLeft(f.days)}</span>
            </li>
          ))}
        </ul>
        <p className={s.note}>{t.forecastNote}</p>
      </section>

      <section className={s.section}>
        <h2>{ru.achievements.title}</h2>
        <ul className={s.achievements}>
          {ACHIEVEMENT_IDS.map((id) => {
            const a = ru.achievements.list[id]!
            const at = data.got.get(id)
            return (
              <li key={id} data-got={at ? true : undefined}>
                <span className={s.achName}>{a.name}</span>
                <span className={s.note}>
                  {a.what}
                  {at ? ` · ${new Date(at).toLocaleDateString('ru-RU')}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </Screen>
  )
}

function Tile({ value, label, note }: { value: number | string; label: ReactNode; note?: string }) {
  return (
    <div className={s.tile}>
      <span className={`${s.tileValue} mono`}>{value}</span>
      <span className={s.tileLabel}>{label}</span>
      {note && <span className={s.tileNote}>{note}</span>}
    </div>
  )
}

/** Минуты по дням: столбики, пунктир — 10 минут (день засчитывается на орбите). */
function DayChart({ days }: { days: { date: string; minutes: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 320
  const H = 120
  const pad = { l: 24, r: 4, t: 8, b: 18 }
  const max = Math.max(ORBIT_DAY_SECONDS / 60 + 5, ...days.map((d) => d.minutes))
  const step = (W - pad.l - pad.r) / days.length
  const bw = Math.max(4, step - 2)
  const y = (m: number) => pad.t + (H - pad.t - pad.b) * (1 - m / max)
  const threshold = ORBIT_DAY_SECONDS / 60
  const label = (d: string) => `${Number(d.slice(8))}.${d.slice(5, 7)}`
  const h = hover !== null ? days[hover] : null
  return (
    <figure className={s.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ru.stats.chartLabel} onPointerLeave={() => setHover(null)}>
        <line className={s.axis} x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} />
        <line className={s.threshold} x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} />
        <text className={s.tick} x={pad.l - 4} y={y(threshold) + 3} textAnchor="end">
          {threshold}
        </text>
        {days.map((d, i) => {
          const x = pad.l + i * step + 1
          const top = y(d.minutes)
          const hgt = Math.max(0, y(0) - top)
          return (
            <g key={d.date}>
              {hgt > 0 && (
                <path
                  className={s.barMark}
                  data-active={hover === i || undefined}
                  d={`M${x},${y(0)} V${top + Math.min(4, hgt)} Q${x},${top} ${x + Math.min(4, bw / 2)},${top} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${top} ${x + bw},${top + Math.min(4, hgt)} V${y(0)} Z`}
                />
              )}
              {(i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2)) && (
                <text className={s.tick} x={x + bw / 2} y={H - 4} textAnchor="middle">
                  {label(d.date)}
                </text>
              )}
              {/* зона наведения шире столбика */}
              <rect x={pad.l + i * step} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
            </g>
          )
        })}
      </svg>
      <figcaption className={s.tooltip} aria-live="polite">
        {h ? ru.stats.tooltip(label(h.date), h.minutes) : ru.stats.chartHint}
      </figcaption>
      <table className="visually-hidden">
        <caption>{ru.stats.chartLabel}</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
