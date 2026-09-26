"""
Аудио для всего контента → public/audio + public/audio/manifest.json.

  .venv\\Scripts\\python.exe scripts\\generate_audio.py        (Windows)
  .venv/bin/python scripts/generate_audio.py                   (macOS/Linux)

1. Слоги с тонами 1–4 и слова — записи носителей (hugolpz/audio-cmn), если есть.
2. Нейтральный тон — TTS по однозначному иероглифу из scripts/syllable_chars.json.
3. Каждое слово — ещё и в двух голосах edge-tts (женский Xiaoxiao, мужской Yunxi).
Кэш TTS — по хэшу (текст + голос + скорость), повторный запуск ничего не перегенерирует.
В конце — отчёт для проверки на слух: docs/audio-review.md.
"""
import asyncio
import hashlib
import json
import shutil
import sys

from audio_lib import AUDIO, CACHE, MANIFEST, ROOT, SOURCES, collect_needs, decode, encode, load_json, process, safe_stem
from prepare_syllables import native_syllable, native_word

VOICES = {"female": ("zh-CN-XiaoxiaoNeural", "edge-xiaoxiao"), "male": ("zh-CN-YunxiNeural", "edge-yunxi")}
RATE = "+0%"

# Многозвучные иероглифы: TTS может выбрать не то чтение — такие слова в отчёт для проверки на слух.
POLYPHONES = set(
    "了行长的得地着还都重为好分发乐觉数教少便种空只看会差相要中一不和大干应奇调朝传处当倒更将角解露落没模难强散省"
    "似提兴血压转曲答薄背参藏称冲单度恶缝供冠横华划济假间降结卷量率论蒙宁喷片铺期切亲圈塞上盛识属宿说挑通系吓鲜旋"
    "与载扎涨正挣作查场乘担否号喝几夹累色舍什"
)


async def tts(text: str, voice: str) -> bytes:
    key = hashlib.sha1(f"{text}|{voice}|{RATE}".encode()).hexdigest()
    path = CACHE / "tts" / f"{key}.mp3"
    if path.exists():
        return path.read_bytes()
    import edge_tts

    path.parent.mkdir(parents=True, exist_ok=True)
    comm = edge_tts.Communicate(text, voice, rate=RATE)
    data = b""
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            data += chunk["data"]
    if not data:
        raise RuntimeError(f"TTS вернул пустой звук: {text} / {voice}")
    path.write_bytes(data)
    return data


def tts_entry(text: str, voice_key: str, stem: str, sub: str) -> dict:
    voice, source = VOICES[voice_key]
    raw = asyncio.run(tts(text, voice))
    tmp = CACHE / "tmp.mp3"
    tmp.write_bytes(raw)
    file, ms = encode(process(decode(tmp)), AUDIO / sub, stem)
    return {"voice": voice_key, "file": file, "source": source, "ms": ms}


def main() -> int:
    syllables, words = collect_needs()
    chars = {k: v for k, v in load_json(ROOT / "scripts" / "syllable_chars.json").items() if not k.startswith("_")}

    # Старые файлы удаляем: имена с хэшем, всё пересоздаётся из кэша за секунды.
    for sub in ("syl", "w"):
        shutil.rmtree(AUDIO / sub, ignore_errors=True)

    manifest = {"version": 1, "sources": SOURCES, "syllables": {}, "texts": {}}
    review: list[str] = []
    errors: list[str] = []

    try:
        for syl in sorted(syllables):
            entry = native_syllable(syl)
            if not entry and syl in chars:
                ch = chars[syl]["char"]
                entry = tts_entry(ch, "female", syl, "syl")
                entry["tts"] = ch
                review.append(f"| слог {syl} | {ch} | TTS женский | нейтральный тон по иероглифу |")
            if entry:
                manifest["syllables"][syl] = entry
            else:
                errors.append(f"нет звука для слога {syl}")

        for wid, hanzi in sorted(words.items()):
            entries = []
            nat = native_word(hanzi)
            if nat:
                entries.append(nat)
            for voice_key in VOICES:
                entries.append(tts_entry(hanzi, voice_key, f"{safe_stem(hanzi)}-{voice_key[0]}", "w"))
            manifest["texts"][hanzi] = entries
            poly = [c for c in hanzi if c in POLYPHONES]
            if poly:
                review.append(
                    f"| слово {hanzi} ({wid}) | многозвучные: {''.join(poly)} | TTS оба голоса{' + носитель' if nat else ''} | проверить чтение |"
                )
    except Exception as e:  # сеть, edge-tts недоступен и т.п. — не молчим
        print(f"\nОШИБКА: {e}", file=sys.stderr)
        print(
            "Если это сетевая ошибка edge-tts: сервис Microsoft мог быть недоступен. Попробуй позже, с другой сетью или через VPN.",
            file=sys.stderr,
        )
        return 1

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    n_files = len(manifest["syllables"]) + sum(len(v) for v in manifest["texts"].values())
    size = sum(p.stat().st_size for p in AUDIO.rglob("*.mp3"))
    print(f"Слогов: {len(manifest['syllables'])}, слов: {len(manifest['texts'])}, файлов: {n_files}, {size / 1024:.0f} КБ")

    report = ROOT / "docs" / "audio-review.md"
    report.write_text(
        "# Звук на проверку на слух\n\n"
        "Генерируется `scripts/generate_audio.py`. Здесь то, что озвучено синтезом и может быть прочитано неверно:\n"
        "нейтральный тон по отдельному иероглифу и слова с многозвучными иероглифами.\n\n"
        "| Что | Иероглифы | Источник | Что проверить |\n|---|---|---|---|\n" + "\n".join(review) + "\n",
        encoding="utf-8",
    )
    print(f"На проверку на слух: {len(review)} позиций → docs/audio-review.md")
    for e in errors:
        print(f"  ОШИБКА: {e}", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
