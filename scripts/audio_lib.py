"""Общие функции аудиоконвейера: декодирование, обрезка тишины, выравнивание громкости, кодирование в mp3."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "src" / "content"
AUDIO = ROOT / "public" / "audio"
MANIFEST = AUDIO / "manifest.json"
CACHE = Path(__file__).resolve().parent / ".cache"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

SR = 24000  # речи хватает полосы до 12 кГц, файлы втрое легче
TARGET_RMS_DB = -18.0
PEAK_LIMIT_DB = -1.0

SYLLABLE = re.compile(r"^[a-zv]+[1-5]$")

SOURCES = {
    "chen-wang": {
        "name": "audio-cmn — слоги, диктор Chen Wang",
        "url": "https://github.com/hugolpz/audio-cmn",
        "license": "CC BY-SA",
        "credit": "Chen Wang; сборка и обработка — Hugo Lopez (PLIDAM, INALCO)",
    },
    "yue-tan": {
        "name": "audio-cmn — слова HSK, диктор Yue Tan (Shtooka, cmn-caen-tan)",
        "url": "https://github.com/hugolpz/audio-cmn",
        "license": "CC BY-SA",
        "credit": "Yue Tan; сборка и обработка — Hugo Lopez (PLIDAM, INALCO)",
    },
    "edge-xiaoxiao": {
        "name": "Синтез речи Microsoft Edge, голос zh-CN-XiaoxiaoNeural",
        "url": "https://github.com/rany2/edge-tts",
        "license": "синтез для личного использования",
        "credit": "Microsoft",
    },
    "edge-yunxi": {
        "name": "Синтез речи Microsoft Edge, голос zh-CN-YunxiNeural",
        "url": "https://github.com/rany2/edge-tts",
        "license": "синтез для личного использования",
        "credit": "Microsoft",
    },
    "edge-xiaoyi": {
        "name": "Синтез речи Microsoft Edge, голос zh-CN-XiaoyiNeural",
        "url": "https://github.com/rany2/edge-tts",
        "license": "синтез для личного использования",
        "credit": "Microsoft",
    },
    "edge-yunjian": {
        "name": "Синтез речи Microsoft Edge, голос zh-CN-YunjianNeural",
        "url": "https://github.com/rany2/edge-tts",
        "license": "синтез для личного использования",
        "credit": "Microsoft",
    },
    "edge-yunyang": {
        "name": "Синтез речи Microsoft Edge, голос zh-CN-YunyangNeural",
        "url": "https://github.com/rany2/edge-tts",
        "license": "синтез для личного использования",
        "credit": "Microsoft",
    },
}


def decode(path: Path) -> np.ndarray:
    out = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-9))


def process(x: np.ndarray) -> np.ndarray:
    """Обрезать тишину по краям, выровнять громкость по звучащей части, мягкие края."""
    frame = int(0.01 * SR)
    n = len(x) // frame
    if n == 0:
        raise ValueError("пустой звук")
    rms = np.array([np.sqrt(np.mean(x[i * frame : (i + 1) * frame] ** 2)) for i in range(n)])
    peak_db = db(float(np.abs(x).max()))
    thr = max(peak_db - 40.0, -55.0)
    loud = np.where(20 * np.log10(np.maximum(rms, 1e-9)) > thr)[0]
    if not len(loud):
        raise ValueError("не найден звук")
    start = max(0, (loud[0] - 5) * frame)  # 50 мс до
    end = min(len(x), (loud[-1] + 9) * frame)  # 90 мс после — хвост тона
    y = x[start:end].astype(np.float64)

    voiced = rms[loud[0] : loud[-1] + 1]
    voiced = voiced[20 * np.log10(np.maximum(voiced, 1e-9)) > thr]
    cur = db(float(np.sqrt(np.mean(voiced**2))))
    gain = 10 ** ((TARGET_RMS_DB - cur) / 20)
    peak_after = np.abs(y).max() * gain
    limit = 10 ** (PEAK_LIMIT_DB / 20)
    if peak_after > limit:
        gain *= limit / peak_after
    y *= gain

    fi, fo = int(0.008 * SR), int(0.02 * SR)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo)
    return y.astype(np.float32)


def encode(y: np.ndarray, dst_dir: Path, stem: str) -> tuple[str, int]:
    """Кодирует в mp3 (моно, 48 кбит/с) с хэшем содержимого в имени. Возвращает (путь от public/audio, мс)."""
    data = subprocess.run(
        [FFMPEG, "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-c:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "-"],
        input=y.tobytes(),
        capture_output=True,
        check=True,
    ).stdout
    h = hashlib.sha1(data).hexdigest()[:8]
    dst_dir.mkdir(parents=True, exist_ok=True)
    name = f"{stem}-{h}.mp3"
    (dst_dir / name).write_bytes(data)
    return (dst_dir / name).relative_to(AUDIO).as_posix(), int(len(y) / SR * 1000)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def safe_stem(text: str) -> str:
    """Имя файла из китайского текста: латиница-хэш, чтобы не было проблем с путями."""
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


CONTENT_DIRS = [CONTENT, CONTENT / "stage1", CONTENT / "story", CONTENT / "stage2"]


def load_all(name: str) -> list:
    out: list = []
    for d in CONTENT_DIRS:
        p = d / f"{name}.json"
        if p.exists():
            out += load_json(p)
    return out


def sentence_texts() -> dict[str, str]:
    """{id фразы: текст} — текст склеен из токенов, как в приложении."""
    return {s["id"]: "".join(t["hanzi"] for t in s["tokens"]) for s in load_all("sentences")}


def collect_needs() -> tuple[set[str], dict[str, str]]:
    """Слоги и слова, которые нужны контенту. Возвращает (слоги, {id слова: иероглифы})."""
    words = {w["id"]: w["hanzi"] for w in load_all("words")}
    lessons = load_all("lessons")
    syl: set[str] = set()
    need_words: dict[str, str] = dict(words)

    def walk(v):
        if isinstance(v, str):
            if SYLLABLE.match(v):
                syl.add(v)
        elif isinstance(v, list):
            for x in v:
                walk(x)
        elif isinstance(v, dict):
            for k, x in v.items():
                if k not in ("title", "body", "ru", "hanzi", "label"):
                    walk(x)

    for lesson in lessons:
        for part in lesson["parts"]:
            walk(part)
            # «послушай оба» после ошибки: тот же слог другими тонами из вариантов ответа
            if part["type"] == "guessTone":
                for item in part["items"]:
                    base = item[:-1]
                    for t in part["choices"]:
                        if t != 5:
                            syl.add(f"{base}{t}")
    # Односложные слова озвучиваются и как слоги (для «Угадай тон»)
    return syl, need_words
