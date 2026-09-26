"""
Аудит набора hugolpz/audio-cmn перед использованием (PHASE1 §2.1).

  .venv\\Scripts\\python.exe scripts\\audit_audio_cmn.py

Считает покрытие слогов по тонам и слов ступени 0 среди записей HSK,
скачивает образцы и меряет: длительность, пик, громкость (RMS), тишину по краям
и контур основного тона — чтобы убедиться, что 2-й тон растёт, 4-й падает и т.д.
"""
import json
import subprocess
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

import imageio_ffmpeg
import numpy as np

REPO = "hugolpz/audio-cmn"
RAW = f"https://raw.githubusercontent.com/{REPO}/master"
CACHE = Path(__file__).parent / ".cache" / "audio-cmn"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 16000


def api(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "xiaohuo"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def tree(path_sha: str) -> list[str]:
    t = api(f"https://api.github.com/repos/{REPO}/git/trees/{path_sha}")
    if t.get("truncated"):
        print("  ! список усечён GitHub API", file=sys.stderr)
    return [e["path"] for e in t["tree"]]


def fetch(rel: str) -> Path:
    dst = CACHE / rel
    if not dst.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        url = f"{RAW}/{urllib.parse.quote(rel)}"
        req = urllib.request.Request(url, headers={"User-Agent": "xiaohuo"})
        with urllib.request.urlopen(req) as r:
            dst.write_bytes(r.read())
    return dst


def decode(path: Path) -> np.ndarray:
    out = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32)


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-9))


def silence_edges(x: np.ndarray, thr_db: float = -40.0) -> tuple[float, float]:
    frame = int(0.01 * SR)
    n = len(x) // frame
    rms = np.array([np.sqrt(np.mean(x[i * frame : (i + 1) * frame] ** 2)) for i in range(n)])
    loud = np.where(20 * np.log10(np.maximum(rms, 1e-9)) > thr_db + db(np.abs(x).max()))[0]
    if not len(loud):
        return len(x) / SR, 0.0
    return loud[0] * 0.01, (n - 1 - loud[-1]) * 0.01


def f0_track(x: np.ndarray) -> list[float]:
    """Основной тон по автокорреляции, 60–400 Гц, шаг 20 мс; None для невокализованных."""
    win, hop = int(0.04 * SR), int(0.02 * SR)
    lo, hi = SR // 400, SR // 60
    peak = np.abs(x).max()
    out = []
    for s in range(0, len(x) - win, hop):
        w = x[s : s + win] * np.hanning(win)
        if np.sqrt(np.mean(w**2)) < 0.05 * peak:
            continue
        ac = np.correlate(w, w, "full")[win - 1 :]
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.35 * ac[0]:
            out.append(SR / lag)
    return out


def contour(f0: list[float]) -> str:
    """Грубо: начало/середина/конец в полутонах относительно медианы."""
    if len(f0) < 4:
        return "мало данных"
    st = 12 * np.log2(np.array(f0) / np.median(f0))
    k = len(st)
    a, m, b = st[: k // 4].mean(), st[k // 3 : 2 * k // 3].mean(), st[-k // 4 :].mean()
    return f"{a:+.1f} → {m:+.1f} → {b:+.1f} пт"


def main() -> None:
    root = {e["name"]: e["sha"] for e in api(f"https://api.github.com/repos/{REPO}/contents/64k")}
    syl = [p for p in tree(root["syllabs"]) if p.endswith(".mp3")]
    hsk = {p[4:-4] for p in tree(root["hsk"]) if p.endswith(".mp3")}

    tones = defaultdict(set)
    for p in syl:
        base, t = p[4:-5], p[-5]
        tones[base].add(t)
    print(f"Слоги: {len(syl)} файлов, {len(tones)} слогов без тона")
    full = sum(1 for t in tones.values() if {"1", "2", "3", "4"} <= t)
    print(f"  со всеми 4 тонами: {full}; нейтральный тон (…5): {sum('5' in t for t in tones.values())}")

    stage0 = "你好 谢谢 再见 我 你 是 不 飞机 中国 铅笔 工作 桌子 明天 学习 词典 同事 朋友 老师 美国 考试 我们 汽车 问题 电脑 很好 可以 不是 不要 一 一个 一天".split()
    missing = [w for w in stage0 if w not in hsk]
    print(f"Слова HSK (второй диктор): {len(hsk)}; из {len(stage0)} слов ступени 0 нет: {' '.join(missing) or '—'}")

    need = ["ma", "ba", "yi", "wu", "da"]
    print("Серии этапа 0.1:", ", ".join(f"{b}:{''.join(sorted(tones[b]))}" for b in need))
    pairs = "ba4 pa4 du4 tu4 ge1 ke1 zai4 cai4 zhi1 chi1 ji1 qi1 zhao3 zao3 chu1 cu1 shi4 si4 shi1 xi1 re4 le4 lv4 lu4 nv3 nu3 shan1 shang1 xin1 xing1".split()
    print("Минимальные пары 0.3, нет файлов:", " ".join(p for p in pairs if f"cmn-{p}.mp3" not in syl) or "—")

    print("\nОбразцы (64 кбит/с):  длит | пик | RMS | тишина до/после | контур F0")
    for name in ["ma1", "ma2", "ma3", "ma4", "ba1", "yi2", "wu3", "da4", "lv4", "zhi1", "xing1", "er2"]:
        x = decode(fetch(f"64k/syllabs/cmn-{name}.mp3"))
        pre, post = silence_edges(x)
        rms = db(float(np.sqrt(np.mean(x**2))))
        print(
            f"  {name:6} {len(x)/SR:4.2f} с | {db(float(np.abs(x).max())):5.1f} dB | {rms:5.1f} dB | "
            f"{pre:4.2f}/{post:4.2f} с | {contour(f0_track(x))}"
        )
    for w in ["你好", "谢谢", "飞机", "朋友"]:
        if w in hsk:
            x = decode(fetch(f"64k/hsk/cmn-{w}.mp3"))
            pre, post = silence_edges(x)
            print(f"  {w:4}  {len(x)/SR:4.2f} с | {db(float(np.abs(x).max())):5.1f} dB | {db(float(np.sqrt(np.mean(x**2)))):5.1f} dB | {pre:4.2f}/{post:4.2f} с")


if __name__ == "__main__":
    import urllib.parse  # noqa: F401  (для quote)

    main()
