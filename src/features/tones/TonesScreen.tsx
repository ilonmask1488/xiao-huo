import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Hanzi, Pinyin } from '../../components/Chinese'
import { PlayButton } from '../../components/Play'
import { ToneChart } from '../../components/ToneChart'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { content } from '../../content'
import type { Tone, Word } from '../../content/types'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import { buildHeatmap, heatmapHasData, PAIR_TONES } from '../../lib/progress/heatmap'
import s from './TonesScreen.module.css'

/**
  Пример слова для каждой ячейки таблицы тоновых пар (слова с меткой «pair:13»).
  Считается при первом обращении, а не при импорте: контент грузится до первого рендера, но после импорта модулей.
*/
let pairExamplesCache: Map<string, Word> | null = null
function pairExamples(): Map<string, Word> {
  pairExamplesCache ??= new Map(
    content.words.flatMap((w) => {
      const cell = w.tags.find((t) => t.startsWith('pair:'))?.slice(5)
      return cell ? [[cell, w] as const] : []
    }),
  )
  return pairExamplesCache
}

export function TonesScreen() {
  const t = ru.tones
  const examples = pairExamples()
  const navigate = useNavigate()
  const stats = useLiveQuery(() => db.toneStats.toArray(), [], [])
  // Из «Тренировки» ведёт ссылка прямо на тепловую карту
  const { hash } = useLocation()
  const heatRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (hash === '#heatmap') heatRef.current?.scrollIntoView({ block: 'start' })
  }, [hash])
  const [cell, setCell] = useState<string | null>(null)
  const heat = buildHeatmap(stats)
  const hasData = heatmapHasData(stats)
  const pingPongReady = examples.size > 0
  const selected = cell ? heat.flat().find((c) => c.pair === cell) : undefined
  const example = cell ? examples.get(cell) : undefined

  return (
    <Screen title={t.title} subtitle={t.subtitle}>
      <ul className={s.list}>
        {t.list.map((tone) => (
          <li key={tone.tone} className={s.tone}>
            <div className={s.contour}>
              <ToneChart tones={[tone.tone as Tone]} />
            </div>
            <div>
              <div className={s.name}>{tone.name}</div>
              <div className={s.shape}>{tone.shape}</div>
              <div className={`${s.chao} mono`}>Чао {tone.chao}</div>
            </div>
            <div className={s.example}>
              <Hanzi className={s.exampleHanzi}>{tone.hanzi}</Hanzi>
              <Pinyin numeric={tone.syl} className={s.exampleSyl} />
            </div>
            <PlayButton item={tone.syl} label={`Послушать ${tone.name}`} size="s" />
          </li>
        ))}
      </ul>

      <h2 className={s.heatTitle} id="heatmap" ref={heatRef}>
        {t.heatmapTitle}
      </h2>
      <p className={s.hint}>{t.heatmapWhat}</p>

      {hasData ? (
        <>
          <p className={s.hint}>{t.heatmapLegend}</p>
          <div className={s.heatmap} role="grid" aria-label={t.heatmapTitle}>
            <span />
            {PAIR_TONES.map((b) => (
              <span key={`c${b}`} className={`${s.hLabel} tone-${b}`} role="columnheader">
                {ru.lesson.toneShort(Number(b))}
              </span>
            ))}
            {heat.map((row, r) => (
              <div key={r} role="row" style={{ display: 'contents' }}>
                <span className={`${s.hLabel} tone-${r + 1}`} role="rowheader">
                  {ru.lesson.toneShort(r + 1)}
                </span>
                {row.map((c) => {
                  const ex = examples.get(c.pair)
                  return (
                    <button
                      key={c.pair}
                      type="button"
                      role="gridcell"
                      className={s.cell}
                      data-empty={c.errorRate === null || undefined}
                      aria-pressed={cell === c.pair}
                      style={c.errorRate === null ? undefined : { ['--err' as string]: String(c.errorRate) }}
                      aria-label={`${c.pair[0]}+${c.pair[1]}: ${c.errorRate === null ? t.heatmapEmpty : t.errorsPct(Math.round(c.errorRate * 100))}`}
                      disabled={!ex}
                      onClick={() => setCell(c.pair === cell ? null : c.pair)}
                    >
                      {ex && <Hanzi className={s.cellHanzi}>{ex.hanzi}</Hanzi>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className={s.legend} aria-hidden>
            <span>{t.legendLow}</span>
            <span className={s.legendBar} />
            <span>{t.legendHigh}</span>
          </div>
          {selected && example && (
            <div className={s.cellPanel}>
              <PlayButton item={example.id} label={`Послушать ${example.hanzi}`} />
              <div>
                <Hanzi className={s.exampleHanzi}>{example.hanzi}</Hanzi> <Pinyin numeric={example.pinyin} className={s.exampleSyl} />
                <div className={s.shape}>
                  {example.ru.join(', ')} ·{' '}
                  {selected.errorRate === null ? t.heatmapEmpty : t.errorsOf(selected.attempts, Math.round(selected.errorRate * 100))}
                </div>
              </div>
              <button type="button" className={ui.primary} onClick={() => navigate(`/game/pingpong?focus=${selected.pair}`)}>
                {t.trainPair}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={s.empty}>
          <p>{t.heatmapEmptyText}</p>
          {pingPongReady ? (
            <button type="button" className={ui.primary} onClick={() => navigate('/game/pingpong')}>
              {t.play}
            </button>
          ) : (
            <p className={s.hint}>{t.heatmapLater}</p>
          )}
        </div>
      )}
    </Screen>
  )
}
