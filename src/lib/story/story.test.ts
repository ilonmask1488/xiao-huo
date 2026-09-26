import { describe, expect, it } from 'vitest'
import { characterById, content, dialogueById, episodes, lessonById, unitById, units } from '../../content'
import { buildLesson, dialogueScreens, isQuestion, isSpoken } from '../lesson/build'
import { autopauseMs, echoTracks, unitPhrases } from '../echo/tracks'
import { episodeStates, voiceFor } from './story'

describe('диалоги и боссы', () => {
  it('каждый этап первой ступени заканчивается диалогом-боссом', () => {
    for (const u of units.filter((x) => x.stage >= 1)) {
      const boss = lessonById.get(u.boss)
      expect(boss?.boss, u.id).toBeTruthy()
      expect(u.lessons.at(-1), u.id).toBe(u.boss)
      expect(boss!.parts.some((p) => p.type === 'dialogue'), u.id).toBe(true)
    }
  })

  it('реплики персонажей — экраны «line», свои реплики с ловушками — вопросы «reply»', () => {
    const d = dialogueById.get(units.find((u) => u.stage === 1)!.dialogues[0]!)!
    const screens = dialogueScreens(d.id, 7)
    expect(screens).toHaveLength(d.lines.length)
    screens.forEach((s, i) => {
      const line = d.lines[i]!
      if (line.choices) {
        expect(s.kind).toBe('reply')
        if (s.kind !== 'reply') return
        expect(new Set(s.options)).toEqual(new Set([line.sentenceId, ...line.choices]))
        expect(isQuestion(s) && isSpoken(s)).toBe(true)
      } else {
        expect(s).toMatchObject({ kind: 'line', speaker: line.speaker, sentenceId: line.sentenceId })
        expect(isQuestion(s)).toBe(false)
      }
    })
    // В каждом диалоге-боссе есть что ответить самому.
    for (const dl of content.dialogues) expect(dl.lines.some((l) => l.choices), dl.id).toBe(true)
  })

  it('диалог в уроке идёт по порядку реплик, не перемешивается', () => {
    const u = units.find((x) => x.stage === 1)!
    const screens = buildLesson(lessonById.get(u.boss)!)
    const idx = screens.filter((s) => s.kind === 'line' || s.kind === 'reply').map((s) => (s as { index: number }).index)
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
    expect(idx.length).toBe(dialogueById.get(u.dialogues[0]!)!.lines.length)
  })
})

describe('«Командировка»', () => {
  it('голос персонажа; «me» — голос из настроек', () => {
    expect(voiceFor('me', 'female')).toBe('female')
    expect(voiceFor('me', 'male')).toBe('male2')
    expect(voiceFor('wanggong', 'female')).toBe(characterById.get('wanggong')!.voice)
    expect(voiceFor('кто-то', 'male')).toBe('female')
  })

  it('четыре эпизода; эпизод открывается после всех уроков этапа', () => {
    expect(episodes.map((e) => e.n)).toEqual([1, 2, 3, 4])
    expect(episodeStates(new Set()).every((e) => !e.open && !e.done)).toBe(true)
    const ep1 = episodes[0]!
    const unit = unitById.get(ep1.unlockAfter)!
    const lessons = unit.lessons.filter((l) => !l.endsWith('-boss'))
    expect(episodeStates(new Set(lessons.slice(0, -1)))[0]!.open).toBe(false)
    const st = episodeStates(new Set([...lessons, ep1.lessonId]))[0]!
    expect(st).toMatchObject({ open: true, done: true })
    expect(st.unlockTitle).toContain(unit.code)
  })

  it('урок эпизода показывает диалог эпизода', () => {
    for (const ep of episodes) {
      const lesson = lessonById.get(ep.lessonId)!
      expect(lesson.parts.some((p) => p.type === 'dialogue' && p.id === ep.dialogueId)).toBe(true)
    }
  })
})

describe('плеер «Эхо»', () => {
  it('автопауза — время фразы × 1,2 с поправкой на скорость', () => {
    expect(autopauseMs(1000, 1)).toBe(1200)
    expect(autopauseMs(1000, 0.75)).toBe(1600)
  })

  it('пройденное — этапы с законченным уроком и открытые эпизоды', () => {
    const none = echoTracks(new Set())
    expect(none.some((t) => t.learned)).toBe(false)
    expect(none.filter((t) => t.kind === 'dialogue').length).toBe(units.filter((u) => u.dialogues.length).length)
    expect(none.filter((t) => t.kind === 'episode').length).toBe(4)

    const u = units.find((x) => x.stage === 1)!
    const tracks = echoTracks(new Set([u.lessons[0]!]))
    const learned = tracks.filter((t) => t.learned).map((t) => t.id)
    expect(learned).toContain(`phrases-${u.id}`)
    expect(learned).toContain(`dialogue-${u.dialogues[0]}`)
  })

  it('фразы этапа — без реплик босса и без повторов', () => {
    const u = units.find((x) => x.stage === 1)!
    const phrases = unitPhrases(u.id)
    expect(phrases.length).toBeGreaterThanOrEqual(3)
    expect(new Set(phrases).size).toBe(phrases.length)
    const bossOnly = dialogueById
      .get(u.dialogues[0]!)!
      .lines.map((l) => l.sentenceId)
      .filter((id) => id.includes('-b'))
    for (const id of bossOnly) expect(phrases).not.toContain(id)
  })
})
