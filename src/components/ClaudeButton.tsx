import { useState } from 'react'
import { ru } from '../i18n/ru'
import { buildPrompt, collectPromptData, copyText } from '../lib/claude/prompt'
import s from './ClaudeButton.module.css'
import ui from './ui.module.css'

/** «Потренироваться с Claude»: собирает промпт и копирует его в буфер. */
export function ClaudeButton({ unitId }: { unitId?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle')
  const [text, setText] = useState('')
  const run = async () => {
    const prompt = buildPrompt(await collectPromptData(unitId))
    setText(prompt)
    setState((await copyText(prompt)) ? 'copied' : 'shown')
  }
  return (
    <div className={s.wrap}>
      <button type="button" className={ui.secondary} onClick={() => void run()}>
        {ru.claude.button}
      </button>
      {state !== 'idle' && (
        <div className={s.result} role="status">
          <p>{state === 'copied' ? ru.claude.copied : ru.claude.copyFailed}</p>
          {state === 'shown' && <textarea className={s.text} readOnly value={text} rows={8} onFocus={(e) => e.target.select()} />}
        </div>
      )}
    </div>
  )
}
