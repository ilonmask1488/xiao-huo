import { Hanzi, Pinyin } from '../../components/Chinese'
import { Screen } from '../../components/ui'
import { ru } from '../../i18n/ru'
import s from './TonesScreen.module.css'

/* Шкала Чао: уровень 1 (низ) … 5 (верх) → координата y в рисунке 72×52. */
const X0 = 14
const X1 = 68
const y = (level: number) => 46 - (level - 1) * 9.5

const CURVES: Record<number, string> = {
  1: `M${X0} ${y(5)} L${X1} ${y(5)}`, // 55
  2: `M${X0} ${y(3)} Q${(X0 + X1) / 2} ${y(3) + 2} ${X1} ${y(5)}`, // 35
  3: `M${X0} ${y(2)} Q${X0 + 16} ${y(1) + 6} ${X0 + 22} ${y(1)} T${X1} ${y(4)}`, // 214
  4: `M${X0} ${y(5)} L${X1} ${y(1)}`, // 51
  5: `M${(X0 + X1) / 2 - 5} ${y(2.5)} L${(X0 + X1) / 2 + 5} ${y(2.3)}`, // короткий, без контура
}

function Contour({ tone }: { tone: number }) {
  return (
    <svg className={`${s.contour} tone-${tone}`} viewBox="0 0 72 52" aria-hidden>
      {[1, 2, 3, 4, 5].map((l) => (
        <g key={l}>
          <line className={s.level} x1={X0} x2={X1} y1={y(l)} y2={y(l)} />
          <text className={s.levelLabel} x={2} y={y(l) + 2.5}>
            {l}
          </text>
        </g>
      ))}
      <path className={s.curve} d={CURVES[tone]} />
    </svg>
  )
}

const PAIR_LABELS = ['1', '2', '3', '4', 'н']

export function TonesScreen() {
  const t = ru.tones
  return (
    <Screen title={t.title} subtitle={t.subtitle}>
      <ul className={s.list}>
        {t.list.map((tone) => (
          <li key={tone.tone} className={s.tone}>
            <Contour tone={tone.tone} />
            <div>
              <div className={s.name}>{tone.name}</div>
              <div className={s.shape}>{tone.shape}</div>
              <div className={`${s.chao} mono`}>Чао {tone.chao}</div>
            </div>
            <div className={s.example}>
              <Hanzi className={s.exampleHanzi}>{tone.hanzi}</Hanzi>
              <Pinyin numeric={tone.syl} className={s.exampleSyl} />
              <span className={s.exampleRu}>{tone.ru}</span>
            </div>
          </li>
        ))}
      </ul>

      <h2>{t.heatmapTitle}</h2>
      <div className={s.heatmap} role="table" aria-label={t.heatmapTitle}>
        <span />
        {PAIR_LABELS.map((l, i) => (
          <span key={`c${l}`} className={`${s.hLabel} tone-${i + 1}`} role="columnheader">
            {l}
          </span>
        ))}
        {PAIR_LABELS.map((row, r) => (
          <div key={`r${row}`} role="row" style={{ display: 'contents' }}>
            <span className={`${s.hLabel} tone-${r + 1}`} role="rowheader">
              {row}
            </span>
            {PAIR_LABELS.map((col) => (
              <span key={col} className={s.cell} role="cell" aria-label={`${row}+${col}: ${t.heatmapEmpty}`} />
            ))}
          </div>
        ))}
      </div>
      <p className={s.hint}>{t.heatmapHint}</p>
      <p className={s.soon}>{t.soon}</p>
    </Screen>
  )
}
