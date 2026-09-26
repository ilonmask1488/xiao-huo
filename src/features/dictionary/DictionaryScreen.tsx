import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hanzi } from '../../components/Chinese'
import { Screen } from '../../components/ui'
import ui from '../../components/ui.module.css'
import { lessonOrder, unitById, wordById } from '../../content'
import type { Word } from '../../content/types'
import { ru } from '../../i18n/ru'
import { db } from '../../lib/db/db'
import { nextLessonId } from '../../lib/lesson/progress'
import { pinyinQueryMatcher } from '../../lib/pinyin/normalize'
import { useSettings } from '../../lib/settings/settings'
import { WordLine } from '../lesson/screens'
import s from './DictionaryScreen.module.css'

type Filter = 'all' | 'hard' | `stage:${number}` | `hsk:${number}` | 'engineering'

export function DictionaryScreen() {
  const t = ru.dictionary
  const navigate = useNavigate()
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const data = useLiveQuery(async () => {
    const completed = new Set((await db.lessonProgress.filter((p) => !!p.completedAt).toArray()).map((p) => p.lessonId))
    // «Трудные» — где сказал «не очень» или ошибся чаще, чем попал.
    const answers = await db.answers.where('item').startsWith('w-').toArray()
    const score = new Map<string, number>()
    for (const a of answers) score.set(a.item, (score.get(a.item) ?? 0) + (a.correct ? -1 : 2))
    return { completed, hard: new Set([...score].filter(([, v]) => v > 0).map(([k]) => k)) }
  })

  const learned: Word[] = useMemo(() => {
    if (!data) return []
    const ids = new Set<string>()
    for (const l of lessonOrder) if (data.completed.has(l.id)) l.newWords.forEach((w) => ids.add(w))
    return [...ids].map((id) => wordById.get(id)!).filter(Boolean)
  }, [data])

  const stageOf = (w: Word) => {
    const l = lessonOrder.find((x) => x.newWords.includes(w.id))
    return l ? (unitById.get(l.unitId)?.stage ?? 0) : 0
  }
  const stages = [...new Set(learned.map(stageOf))].sort()
  const hskOf = (w: Word) => (settings.hskScale === 'hsk2' ? w.hsk2 : w.hsk3)
  const hskLevels = [...new Set(learned.map(hskOf).filter((n): n is number => !!n && n <= 3))].sort()

  const q = query.trim()
  const matchPinyin = pinyinQueryMatcher(q)
  const shown = learned.filter((w) => {
    if (filter === 'hard' && !data?.hard.has(w.id)) return false
    if (filter.startsWith('hsk:') && hskOf(w) !== Number(filter.slice(4))) return false
    if (filter === 'engineering' && !w.tags.includes('engineering')) return false
    if (filter.startsWith('stage:') && stageOf(w) !== Number(filter.slice(6))) return false
    if (!q) return true
    const lq = q.toLowerCase()
    return w.hanzi.includes(q) || w.ru.some((r) => r.toLowerCase().includes(lq)) || (matchPinyin?.(w.pinyin) ?? false)
  })

  if (data && !learned.length) {
    const next = nextLessonId(data.completed)
    return (
      <Screen title={t.title}>
        <div className={s.empty}>
          <Hanzi className={s.emptyGlyph}>字</Hanzi>
          <p>{t.empty}</p>
          {next && (
            <button type="button" className={ui.primary} onClick={() => navigate(`/lesson/${next}`)}>
              {t.toFirstLesson}
            </button>
          )}
        </div>
      </Screen>
    )
  }

  const chips: { id: Filter; label: string; show: boolean }[] = [
    { id: 'all', label: t.all(learned.length), show: true },
    ...stages.map((n) => ({ id: `stage:${n}` as Filter, label: t.stage(n), show: stages.length > 1 })),
    ...hskLevels.map((n) => ({ id: `hsk:${n}` as Filter, label: `HSK ${n}`, show: true })),
    { id: 'engineering', label: t.engineering, show: learned.some((w) => w.tags.includes('engineering')) },
    { id: 'hard', label: t.hard, show: (data?.hard.size ?? 0) > 0 },
  ]

  return (
    <Screen title={t.title}>
      <label className={s.search}>
        <span className="visually-hidden">{t.search}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      <div className={s.filters} role="radiogroup" aria-label={t.filter}>
        {chips
          .filter((c) => c.show)
          .map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={filter === c.id} className={s.chip} onClick={() => setFilter(c.id)}>
              {c.label}
            </button>
          ))}
      </div>
      {shown.length ? (
        <div className={s.list}>
          {shown.map((w) => (
            <WordLine key={w.id} id={w.id} showSandhi href={`/word/${w.id}`} />
          ))}
        </div>
      ) : (
        <p className={s.nothing}>{t.nothing}</p>
      )}
    </Screen>
  )
}
