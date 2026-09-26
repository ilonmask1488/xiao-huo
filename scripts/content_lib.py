"""
Общее для скриптов-источников контента: персонажи «Командировки» и сборка диалогов.

Диалог записывается строками (кто, текст[, варианты-ловушки]):
  ("xiaoli", "你好！我叫[小李:xiao3 li3]。")
  ("me", "我是俄罗斯人。", ["我很好，你呢？", "他是老师吗？"])
Реплика «me» с вариантами — выбор ответа; текст ищется среди уже заведённых фраз,
иначе заводится новая фраза (с разбивкой на слова по словарю курса).
"""
import re
from typing import Callable

# Голоса: female — Xiaoxiao, male — Yunxi, female2 — Xiaoyi, male2 — Yunjian, male3 — Yunyang.
# «me» (стажёр — это ты) озвучивается голосом из настроек: female или male2.
CHARACTERS = [
    {"id": "me", "hanzi": "萨沙", "pinyin": "sa4 sha1", "ru": "Саша — инженер-стажёр из России. Это ты.", "voice": "me"},
    {"id": "xiaoli", "hanzi": "小李", "pinyin": "xiao3 li3", "ru": "Сяо Ли — весёлый коллега, твой ровесник. Знает всех и всё.", "voice": "male"},
    {"id": "wanggong", "hanzi": "王工", "pinyin": "wang2 gong1", "ru": "Инженер Ван — строгий главный инженер. Говорит коротко, но справедлив.", "voice": "male3"},
    {"id": "siji", "hanzi": "司机", "pinyin": "si1 ji1", "ru": "Таксист. Любит поболтать.", "voice": "male2"},
    {"id": "fuwuyuan", "hanzi": "服务员", "pinyin": "fu2 wu4 yuan2", "ru": "Администратор гостиницы. Очень вежливая.", "voice": "female2"},
    {"id": "ayi", "hanzi": "阿姨", "pinyin": "a1 yi2", "ru": "Тётушка на раздаче и на рынке. Накормит и посоветует.", "voice": "female"},
]
SPEAKERS = {c["id"] for c in CHARACTERS}


def plain(text: str) -> str:
    """Текст без разметки: [王明:wang2 ming2] → 王明, «|» убираются."""
    return re.sub(r"\[([^:\]]+):[^\]]+\]", r"\1", text).replace("|", "")


def make_dialogue(
    did: str,
    unit_id: str,
    title: str,
    lines: list[tuple],
    known: dict[str, str],
    new_sentence: Callable[[str, str, str], str],
    culture: str | None = None,
) -> dict:
    """
    Строка: (кто, текст, перевод или None[, ловушки]). Ловушка — текст уже заведённой фразы
    или пара (текст, перевод). Перевод обязателен, только если фразы ещё нет.
    known: {текст фразы без разметки: id} — уже заведённые фразы (пополняется).
    new_sentence(text_with_markup, unit_id, ru) → id новой фразы.
    """

    def sid_for(text: str, ru: str | None) -> str:
        key = plain(text)
        if key not in known:
            if not ru:
                raise SystemExit(f"{did}: новая фраза «{key}» без перевода")
            known[key] = new_sentence(text, unit_id, ru)
        return known[key]

    out_lines = []
    run_speaker, run = None, 0
    for line in lines:
        speaker, text, ru = line[0], line[1], line[2] if len(line) > 2 else None
        if speaker not in SPEAKERS:
            raise SystemExit(f"{did}: нет персонажа «{speaker}»")
        entry = {"speaker": speaker, "sentenceId": sid_for(text, ru)}
        if len(line) > 3 and line[3]:
            if speaker != "me":
                raise SystemExit(f"{did}: варианты ответа бывают только у реплик «me»")
            entry["choices"] = [sid_for(c, None) if isinstance(c, str) else sid_for(c[0], c[1]) for c in line[3]]
            if entry["sentenceId"] in entry["choices"]:
                raise SystemExit(f"{did}: верный ответ среди ловушек: {text}")
        out_lines.append(entry)
        run = run + 1 if speaker == run_speaker else 1
        run_speaker = speaker
        if run > 3:
            raise SystemExit(f"{did}: больше 3 реплик подряд у одного персонажа")
    chars = sorted({l["speaker"] for l in out_lines})
    d = {"id": did, "unitId": unit_id, "title": title, "characters": chars, "lines": out_lines}
    if culture:
        d["cultureNote"] = culture
    return d
