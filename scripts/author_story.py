"""
Сюжет «Командировка» (ТЗ §6.3), эпизоды 1–4 → src/content/story/{episodes,words,sentences,dialogues,lessons}.json

  .venv\\Scripts\\python.exe scripts\\author_story.py      (после author_stage1.py)

Российский инженер-стажёр Саша едет к китайскому партнёру. Эпизод открывается после этапа,
чьих слов достаточно; новые слова эпизода помечаются в фразах как «новые» (правило i+1).
"""
import json
from pathlib import Path

from author_stage1 import tokenize
from content_lib import make_dialogue, plain

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content" / "story"
SASHA = "[萨沙:sa4 sha1]"
LI = "[小李:xiao3 li3]"

# Слова, которые встречаются только в сюжете (в словарь попадают как «из сюжета»).
STORY_WORDS = [
    ("w-huanying", "欢迎", "huan1 ying2", ["добро пожаловать"], "гл."),
    ("w-nimen", "你们", "ni3 men5", ["вы (много людей)"], "мест."),
    ("w-binguan", "宾馆", "bin1 guan3", ["гостиница"], "сущ."),
    ("w-tian", "天", "tian1", ["день", "небо"], "сущ."),
    ("w-fangjian", "房间", "fang2 jian1", ["комната", "номер"], "сущ."),
    ("w-la", "辣", "la4", ["острый (о еде)"], "прил."),
]

EPISODES = [
    {
        "n": 1, "title": "Прилёт", "unlockAfter": "s1-u1",
        "blurb": "Аэропорт Пекина. Тебя встречает коллега Сяо Ли.",
        "scene": [
            "Ты — Саша, инженер-стажёр. Летишь в Пекин к китайскому партнёру на испытания.",
            "В зоне прилёта стоит парень с табличкой «萨沙». Это Сяо Ли, твой будущий коллега.",
        ],
        "lines": [
            ("xiaoli", f"你好！你是{SASHA}吗？", "Привет! Ты Саша?"),
            ("me", f"是，我是{SASHA}。", None, [("你叫什么名字？", None), ("我们是朋友。", None)]),
            ("xiaoli", f"欢迎！我叫{LI}，我是工程师。", "Добро пожаловать! Меня зовут Сяо Ли, я инженер."),
            ("me", f"你好，{LI}！认识你很高兴。", "Привет, Сяо Ли! Рад познакомиться.", [("他是老师吗？", None), ("你是哪国人？", None)]),
            ("xiaoli", "认识你很高兴！你是俄罗斯人吗？", "Рад знакомству! Ты русский?"),
            ("me", "是，我是俄罗斯人。", "Да, я русский.", [("我很|好，你呢？", None), ("她叫什么名字？", None)]),
            ("xiaoli", "好！我们是朋友！", "Отлично! Будем друзьями!"),
        ],
        "culture": (
            "Как обращаться к коллегам",
            [
                "Коллег зовут по фамилии с 小 («младший») или 老 («старший»): 小李 — так говорят о молодых.",
                "Главного инженера по фамилии Ван зовут 王工 — «инженер Ван». Визитку дают и берут двумя руками и сразу читают — это уважение.",
            ],
        ),
    },
    {
        "n": 2, "title": "Такси из аэропорта", "unlockAfter": "s1-u7",
        "blurb": "Сяо Ли везёт тебя в гостиницу. Таксист хочет всё знать.",
        "scene": ["Вы с Сяо Ли садитесь в такси. Таксисты в Пекине любят поговорить — отличная практика."],
        "lines": [
            ("siji", "你们去哪|里？", "Куда едете?"),
            ("xiaoli", "我们去北京宾馆。", "Нам в гостиницу «Пекин»."),
            ("siji", "好！你是中国人吗？", "Понял! Ты китаец?"),
            ("me", "不是，我是俄罗斯人。", "Нет, я русский.", [("我去火车站。", None), ("他开出租车。", None)]),
            ("siji", "俄罗斯很大！", "Россия большая!"),
            ("me", "中国很大。", None, [("我想睡觉。", None), ("十块钱。", None)]),
            ("siji", "你是工程师吗？", "Ты инженер?"),
            ("me", "是，我是工程师。", "Да, я инженер.", [("我在北京。", None), ("你来我家吗？", None)]),
            ("siji", "宾馆在前面。", "Гостиница впереди."),
            ("me", "谢谢！多少钱？", "Спасибо! Сколько с меня?", [("你什么时候回来？", None), ("书在桌子上。", None)]),
            ("siji", "五十块。", "Пятьдесят юаней."),
        ],
        "culture": (
            "Такси и деньги",
            [
                "Чаевые в Китае не приняты — ни в такси, ни в кафе.",
                "Почти все платят телефоном: WeChat Pay или Alipay. Наличные берут, но сдачу могут искать долго.",
            ],
        ),
    },
    {
        "n": 3, "title": "Гостиница", "unlockAfter": "s1-u9",
        "blurb": "Заселение. Администратор очень вежлива — будь и ты.",
        "scene": ["Гостиница «Пекин». Администратор за стойкой улыбается и ждёт паспорт."],
        "lines": [
            ("fuwuyuan", "你好！欢迎！", "Здравствуйте! Добро пожаловать!"),
            ("me", f"你好！我叫{SASHA}，我是俄罗斯人。", "Здравствуйте! Меня зовут Саша, я из России.", [("请坐。", None), ("没关系。", None)]),
            ("fuwuyuan", "你住几天？", "На сколько дней?"),
            ("me", "我住五天。", "На пять дней.", [("我去火车站。", None), ("现在三点。", None)]),
            ("fuwuyuan", "这是你的房间。", "Вот ваш номер."),
            ("me", "房间里有电视吗？", "В номере есть телевизор?", [("这个字怎么读？", None), ("我没看见他。", None)]),
            ("fuwuyuan", "有。你的房间很大！", "Есть. У вас большой номер!"),
            ("me", "太|好|了！谢谢！", "Отлично! Спасибо!", [("对不起！", None), ("太贵了！", None)]),
            ("fuwuyuan", "不客气。", None),
        ],
        "culture": (
            "Паспорт и завтрак",
            [
                "При заселении иностранцы обязательно показывают паспорт — так требует закон.",
                "Завтрак в гостинице чаще китайский: рисовая каша, пампушки на пару и яйца. Чай вместо кофе — норма.",
            ],
        ),
    },
    {
        "n": 4, "title": "Столовая: 辣不辣？", "unlockAfter": "s1-u6",
        "blurb": "Обед на заводе. Главный вопрос — остро или нет.",
        "scene": ["Полдень. Сяо Ли ведёт тебя в заводскую столовую. На раздаче — тётушка с половником."],
        "lines": [
            ("xiaoli", "中午我们去饭馆。", "Днём идём в столовую."),
            ("ayi", "你想吃什么？", None),
            ("me", "这个菜辣不辣？", "Это блюдо острое?", [("我想买苹果。", None), ("太贵了！", None)]),
            ("ayi", "很辣！", "Очень острое!"),
            ("me", "我不吃辣的。", "Я не ем острое.", [("我很喜欢中国菜。", None), ("我买三个。", None)]),
            ("ayi", "那你吃米饭和这个菜。", "Тогда бери рис и вот это блюдо."),
            ("xiaoli", "你喝茶吗？", None),
            ("me", "我喝水。", "Я буду воду.", [("我想吃米饭。", None), ("你买多少？", None)]),
            ("xiaoli", "中国菜好吃吗？", "Китайская еда вкусная?"),
            ("me", "很|好吃！", "Очень вкусная!", [("太贵了！", None), ("我不喝茶，我喝水。", None)]),
        ],
        "culture": (
            "Острое и кто платит",
            [
                "辣不辣？ — «остро или нет?» — главный вопрос в Китае. На севере едят мягче, в Сычуани — огонь.",
                "За общим обедом платит тот, кто пригласил, и спорить за счёт — часть ритуала. Чай в столовой обычно бесплатный.",
            ],
        ),
    },
]


def build() -> None:
    words0 = json.loads((ROOT / "src/content/words.json").read_text(encoding="utf-8"))
    words1 = json.loads((ROOT / "src/content/stage1/words.json").read_text(encoding="utf-8"))
    sents1 = json.loads((ROOT / "src/content/stage1/sentences.json").read_text(encoding="utf-8"))
    dictionary = {w["hanzi"]: (w["id"], w["pinyin"]) for w in words0 + words1}
    story_ids = set()
    words_out = []
    for wid, hanzi, py, ru_, pos in STORY_WORDS:
        if hanzi in dictionary:
            raise SystemExit(f"Слово {hanzi} уже есть в курсе")
        dictionary[hanzi] = (wid, py)
        story_ids.add(wid)
        words_out.append({"id": wid, "hanzi": hanzi, "pinyin": py, "ru": ru_, "pos": pos, "tags": ["story"], "reviewed": False})

    known = {"".join(t["hanzi"] for t in s["tokens"]): s["id"] for s in sents1}
    sentences_out, dialogues_out, lessons_out, episodes_out = [], [], [], []

    for ep in EPISODES:
        n = ep["n"]
        counter = [0]

        def new_sentence(text: str, unit_id: str, ru_: str, n=n) -> str:
            counter[0] += 1
            sid = f"s-ep{n}-{counter[0]:02d}"
            toks = tokenize(text, dictionary)
            s = {"id": sid, "tokens": toks, "ru": ru_, "unitId": unit_id, "reviewed": False}
            fresh = sorted({t["wordId"] for t in toks if t.get("wordId") in story_ids})
            if fresh:
                s["newWordIds"] = fresh
            sentences_out.append(s)
            return sid

        did = f"d-ep{n}"
        title, culture = ep["culture"]
        d = make_dialogue(did, ep["unlockAfter"], ep["title"], ep["lines"], known, new_sentence, culture=" ".join(culture))
        dialogues_out.append(d)
        lesson_id = f"story-{n}"
        lessons_out.append(
            {
                "id": lesson_id, "unitId": "story", "order": n, "title": f"Эпизод {n}. {ep['title']}", "newWords": [],
                "parts": [
                    {"type": "explain", "title": ep["title"], "body": ep["scene"], "mascot": "wink"},
                    {"type": "dialogue", "id": did},
                    {"type": "explain", "title": f"Культура: {title}", "body": culture, "mascot": "thinking"},
                ],
            }
        )
        episodes_out.append({"id": f"ep{n}", "n": n, "title": ep["title"], "blurb": ep["blurb"], "unlockAfter": ep["unlockAfter"], "lessonId": lesson_id, "dialogueId": did})

    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in (
        ("words", words_out),
        ("sentences", sentences_out),
        ("dialogues", dialogues_out),
        ("lessons", lessons_out),
        ("episodes", episodes_out),
    ):
        (OUT / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Эпизодов {len(episodes_out)}, новых фраз {len(sentences_out)}, слов сюжета {len(words_out)}")


if __name__ == "__main__":
    build()
