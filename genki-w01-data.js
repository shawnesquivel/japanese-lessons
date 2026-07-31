// Genki I (3rd ed.) Workbook — Lesson 1 Listening Comprehension (p. 12)
// Proof-of-concept map: CD track -> exercise -> per-item time clip.
// Clip boundaries come from whisper segment timestamps on the user's own CD
// audio; answers verified against the audio transcripts.
// Conventions: no answer is revealed in prompts; Japanese shown in kana only,
// paired with romaji + English on reveal.
window.GENKI_W01 = {
  lesson: 1,
  source: "Genki I (3rd ed.) Workbook, Lesson 1 Listening Comprehension, p. 12",
  exercises: [
    {
      id: "w01-a",
      letter: "A",
      file: "audio/genki/W01-A.mp3",
      kind: "choice",
      title: "Greeting match",
      instruction:
        "You will hear a number and a greeting. Tap the greeting you heard.",
      bank: [
        { jp: "ありがとうございます", rj: "arigatou gozaimasu", en: "thank you" },
        { jp: "さようなら", rj: "sayounara", en: "goodbye" },
        { jp: "あっ、すみません", rj: "a, sumimasen", en: "oh, excuse me" },
        { jp: "おはようございます", rj: "ohayou gozaimasu", en: "good morning" },
        { jp: "おやすみなさい", rj: "oyasuminasai", en: "good night" },
        { jp: "こんにちは", rj: "konnichiwa", en: "hello (daytime)" },
        { jp: "はじめまして、よろしくおねがいします", rj: "hajimemashite, yoroshiku onegaishimasu", en: "nice to meet you" },
        { jp: "こんばんは", rj: "konbanwa", en: "good evening" },
        { jp: "ごちそうさま", rj: "gochisousama", en: "thanks for the meal" },
        { jp: "いってきます", rj: "ittekimasu", en: "I'm off / see you later" },
        { jp: "ただいま", rj: "tadaima", en: "I'm home" }
      ],
      items: [
        { id: "genki-w01-a-01", n: 1, start: 8.4, end: 13.0, answer: "ありがとうございます" },
        { id: "genki-w01-a-02", n: 2, start: 15.9, end: 20.0, answer: "さようなら" },
        { id: "genki-w01-a-03", n: 3, start: 22.9, end: 28.5, answer: "あっ、すみません" },
        { id: "genki-w01-a-04", n: 4, start: 30.9, end: 36.0, answer: "おはようございます" },
        { id: "genki-w01-a-05", n: 5, start: 38.4, end: 43.0, answer: "おやすみなさい" },
        { id: "genki-w01-a-06", n: 6, start: 45.4, end: 51.0, answer: "こんにちは" },
        { id: "genki-w01-a-07", n: 7, start: 51.4, end: 60.5, answer: "はじめまして、よろしくおねがいします" },
        { id: "genki-w01-a-08", n: 8, start: 62.9, end: 67.5, answer: "こんばんは" },
        { id: "genki-w01-a-09", n: 9, start: 69.9, end: 75.0, answer: "ごちそうさま" },
        { id: "genki-w01-a-10", n: 10, start: 75.4, end: 81.5, answer: "いってきます" },
        { id: "genki-w01-a-11", n: 11, start: 84.9, end: 89.5, answer: "ただいま" }
      ]
    },
    {
      id: "w01-b",
      letter: "B",
      file: "audio/genki/W01-B.mp3",
      kind: "reply",
      title: "What time is it?",
      instruction:
        "You will hear a short dialogue about the time in a city. Answer in English, then reveal.",
      items: [
        {
          id: "genki-w01-b-1", n: 1, start: 16.9, end: 30.2,
          q: "What time is it in Paris (パリ)?",
          jp: "いま ごぜん よじ です", rj: "ima gozen yo-ji desu",
          en: "It's 4 AM."
        },
        {
          id: "genki-w01-b-2", n: 2, start: 29.9, end: 44.2,
          q: "What time is it in Seoul (ソウル)? (It is 7 o'clock where the speaker is.)",
          jp: "ごご くじ です", rj: "gogo ku-ji desu",
          en: "It's 9 PM."
        },
        {
          id: "genki-w01-b-3", n: 3, start: 43.9, end: 56.2,
          q: "What time is it in New York (ニューヨーク)?",
          jp: "ごご いちじ です", rj: "gogo ichi-ji desu",
          en: "It's 1 PM."
        },
        {
          id: "genki-w01-b-4", n: 4, start: 55.9, end: 69.2,
          q: "What time is it in London (ロンドン)?",
          jp: "ごぜん しちじはん です", rj: "gozen shichi-ji-han desu",
          en: "It's 7:30 AM."
        },
        {
          id: "genki-w01-b-5", n: 5, start: 68.9, end: 79.2,
          q: "What time is it in Taipei (たいぺい)?",
          jp: "ごぜん じゅういちじ です", rj: "gozen juuichi-ji desu",
          en: "It's 11 AM."
        },
        {
          id: "genki-w01-b-6", n: 6, start: 81.9, end: 93.2,
          q: "What time is it in Sydney (シドニー)?",
          jp: "ごご さんじはん です", rj: "gogo san-ji-han desu",
          en: "It's 3:30 PM."
        }
      ]
    },
    {
      id: "w01-c",
      letter: "C",
      file: "audio/genki/W01-C.mp3",
      kind: "input",
      title: "Telephone numbers",
      instruction:
        "You will hear a telephone number. Type it with a hyphen, e.g. 51-6751, then check.",
      items: [
        {
          id: "genki-w01-c-1", n: 1, start: 18.0, end: 36.6,
          name: "かわさき", digits: "905-0877",
          jp: "きゅう まる ごー の まる はち なな なな です",
          rj: "kyuu maru goo no maru hachi nana nana desu"
        },
        {
          id: "genki-w01-c-2", n: 2, start: 36.3, end: 56.6,
          name: "すずき", digits: "5934-1026",
          jp: "ごー きゅう さん よん の いち まる にい ろく です",
          rj: "goo kyuu san yon no ichi maru ni roku desu"
        },
        {
          id: "genki-w01-c-3", n: 3, start: 56.3, end: 73.6,
          name: "うえだ", digits: "49-1509",
          jp: "よん きゅう の いち ごー まる きゅう です",
          rj: "yon kyuu no ichi goo maru kyuu desu"
        },
        {
          id: "genki-w01-c-4", n: 4, start: 73.3, end: 92.9,
          name: "トンプソン", digits: "6782-3333",
          jp: "ろく なな はち にい の さん さん さん さん です",
          rj: "roku nana hachi ni no san san san san desu"
        }
      ]
    },
    {
      id: "w01-d",
      letter: "D",
      file: "audio/genki/W01-D.mp3",
      kind: "card",
      title: "Who is speaking?",
      instruction:
        "You will hear a dialogue about a student. Tap the name card that matches, then check.",
      cards: [
        {
          cid: "a", name: "やました アキラ", rj: "Yamashita Akira",
          school: "にほんだいがく", schoolEn: "Nihon University",
          year: "いちねんせい", yearEn: "1st year"
        },
        {
          cid: "b", name: "スミス ケイト", rj: "Smith Kate",
          school: "アメリカだいがく", schoolEn: "America University",
          year: "さんねんせい", yearEn: "3rd year"
        },
        {
          cid: "c", name: "たなか たけし", rj: "Tanaka Takeshi",
          school: "とうきょうだいがく", schoolEn: "Tokyo University",
          year: "よねんせい", yearEn: "4th year"
        }
      ],
      items: [
        {
          id: "genki-w01-d-1", n: 1, start: 0.0, end: 18.7, answer: "a",
          jp: "にほんだいがくの いちねんせいです。せんこうは ビジネスです",
          rj: "Nihon daigaku no ichinensei desu. senkou wa bijinesu desu",
          en: "A 1st-year at Nihon University. Major: business."
        },
        {
          id: "genki-w01-d-2", n: 2, start: 18.6, end: 32.4, answer: "b",
          jp: "アメリカだいがくの さんねんせいです。せんこうは にほんごです",
          rj: "Amerika daigaku no sannensei desu. senkou wa nihongo desu",
          en: "A 3rd-year at America University. Major: Japanese."
        }
      ]
    }
  ]
};
