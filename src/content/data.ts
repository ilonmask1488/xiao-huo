/*
  Сырые данные курса. Модуль подключается динамически (loadContent в index.ts), поэтому JSON
  уходит в отдельный кусок, а не в основной бандл: с тремя ступенями это ~60 КБ gzip.
*/
import charactersJson from './characters.json'
import dialoguesJson from './dialogues.json'
import lessonsJson from './lessons.json'
import sentencesJson from './sentences.json'
import s1Dialogues from './stage1/dialogues.json'
import s1Lessons from './stage1/lessons.json'
import s1Sentences from './stage1/sentences.json'
import s1Units from './stage1/units.json'
import s1Words from './stage1/words.json'
import s2Dialogues from './stage2/dialogues.json'
import s2Lessons from './stage2/lessons.json'
import s2Sentences from './stage2/sentences.json'
import s2Units from './stage2/units.json'
import s2Words from './stage2/words.json'
import s3Dialogues from './stage3/dialogues.json'
import s3Lessons from './stage3/lessons.json'
import s3Sentences from './stage3/sentences.json'
import s3Units from './stage3/units.json'
import s3Words from './stage3/words.json'
import storyDialogues from './story/dialogues.json'
import storyEpisodes from './story/episodes.json'
import storyLessons from './story/lessons.json'
import storySentences from './story/sentences.json'
import storyWords from './story/words.json'
import type { Character, Content, Dialogue, Episode, Lesson, Sentence, Unit, Word } from './types'
import unitsJson from './units.json'
import wordsJson from './words.json'

export const raw: Content = {
  units: [...unitsJson, ...s1Units, ...s2Units, ...s3Units] as Unit[],
  lessons: [...lessonsJson, ...s1Lessons, ...s2Lessons, ...s3Lessons, ...storyLessons] as Lesson[],
  words: [...wordsJson, ...s1Words, ...storyWords, ...s2Words, ...s3Words] as Word[],
  sentences: [...sentencesJson, ...s1Sentences, ...storySentences, ...s2Sentences, ...s3Sentences] as Sentence[],
  dialogues: [...dialoguesJson, ...s1Dialogues, ...s2Dialogues, ...s3Dialogues, ...storyDialogues] as Dialogue[],
  characters: charactersJson as Character[],
  episodes: storyEpisodes as Episode[],
}
