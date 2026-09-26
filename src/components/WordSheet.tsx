/*
  Перевод в один тап (UX §1.5): любое китайское слово в приложении → лист с иероглифами, пиньинем,
  переводом и звуком. Провайдер стоит в оболочке, экраны вызывают useWordSheet().
*/
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { wordById } from '../content'
import type { Token, Word } from '../content/types'
import { ru } from '../i18n/ru'
import { wordRu } from '../lib/words'
import { Hanzi, Pinyin } from './Chinese'
import { PlayButton } from './Play'
import { Sheet } from './Sheet'
import s from './WordSheet.module.css'

export type WordTarget = { word: Word } | { token: Token }

const Ctx = createContext<(t: WordTarget) => void>(() => {})

export function useWordSheet() {
  return useContext(Ctx)
}

export function WordSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<WordTarget | null>(null)
  const open = (t: WordTarget) => {
    const w = 'token' in t && t.token.wordId ? wordById.get(t.token.wordId) : undefined
    setTarget(w ? { word: w } : t)
  }
  const close = () => setTarget(null)
  const t = ru.wordSheet
  return (
    <Ctx.Provider value={open}>
      {children}
      {target && (
        <Sheet title={t.title} onClose={close} okLabel={t.close}>
          {'word' in target ? (
            <div className={s.card} data-testid="word-sheet">
              <Hanzi className={s.hanzi}>{target.word.hanzi}</Hanzi>
              <Pinyin numeric={target.word.pinyin} className={s.pinyin} />
              <p className={s.ru}>{wordRu(target.word)}</p>
              <PlayButton item={target.word.id} label={ru.lesson.listenAgain} size="s" />
              <Link to={`/word/${target.word.id}`} className={s.more} onClick={close}>
                {t.more}
              </Link>
            </div>
          ) : (
            <div className={s.card} data-testid="word-sheet">
              <Hanzi className={s.hanzi}>{target.token.hanzi}</Hanzi>
              {target.token.pinyin && <Pinyin numeric={target.token.pinyin} className={s.pinyin} />}
              <p className={s.ru}>{target.token.ru ?? t.name}</p>
            </div>
          )}
        </Sheet>
      )}
    </Ctx.Provider>
  )
}

/** Обёртка, делающая слово нажимаемым: тап → лист с переводом. */
export function WordTap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const open = useWordSheet()
  const w = wordById.get(id)
  if (!w) return <>{children}</>
  return (
    <button type="button" className={`${s.tap} ${className ?? ''}`} aria-label={ru.wordSheet.open(w.hanzi)} onClick={() => open({ word: w })}>
      {children}
    </button>
  )
}
