"""
Записи носителей из hugolpz/audio-cmn (CC BY-SA): слоги с тонами 1–4 и слова HSK.
Скачивает только то, что нужно контенту, обрезает тишину, выравнивает громкость,
кодирует в mp3 и возвращает записи для манифеста. Вызывается из generate_audio.py.
"""
import urllib.parse
import urllib.request
from pathlib import Path

from audio_lib import AUDIO, CACHE, decode, encode, process, safe_stem

RAW = "https://raw.githubusercontent.com/hugolpz/audio-cmn/master/64k"


def fetch(rel: str) -> Path | None:
    dst = CACHE / "audio-cmn" / rel
    if dst.exists():
        return dst if dst.stat().st_size > 0 else None
    dst.parent.mkdir(parents=True, exist_ok=True)
    url = f"{RAW}/{urllib.parse.quote(rel)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "xiaohuo"})
        with urllib.request.urlopen(req, timeout=30) as r:
            dst.write_bytes(r.read())
        return dst
    except urllib.error.HTTPError as e:
        if e.code == 404:
            dst.write_bytes(b"")  # запоминаем, что записи нет
            return None
        raise


def native_syllable(syl: str) -> dict | None:
    """ma3 → запись носителя. Нейтральный тон (5) в наборе ненадёжен — не берём."""
    if syl.endswith("5"):
        return None
    src = fetch(f"syllabs/cmn-{syl}.mp3")
    if not src:
        return None
    file, ms = encode(process(decode(src)), AUDIO / "syl", syl)
    return {"file": file, "source": "chen-wang", "ms": ms}


def native_word(hanzi: str) -> dict | None:
    src = fetch(f"hsk/cmn-{hanzi}.mp3")
    if not src:
        return None
    file, ms = encode(process(decode(src)), AUDIO / "w", safe_stem(hanzi) + "-n")
    return {"voice": "native", "file": file, "source": "yue-tan", "ms": ms}
